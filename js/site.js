var client = new QuranClient('https://semantic-quran.azure-mobile.net/', 'okajHbuHsfhRmylXmwQgOKAsnmUyKG49'),
    verseNumPattern = /^(\d{1,3})(?:$|[ :/](\d{1,3})(?:$|-(\d{1,3})$))/,
    tagsRecentlyAdded = [],
    resultTemplate,
    tagListTemplate,
    verseTagTemplate,
    surahSelector,
    surahTitleTemplate,
    resultPane,
    preText,
    router,
    appView,
    currentSurah,
    mainPageHeading,
    surahList = [],
    LastSurah = 114,
    nameSurahMap = {};

// Prevents all anchor click handling
$.mobile.linkBindingEnabled = false;

// Disabling this will prevent jQuery Mobile from handling hash changes
$.mobile.hashListeningEnabled = false;

var Workspace = Backbone.Router.extend({
    routes: {
        '': 'home',
        'search/:term': 'search',
        ':surah/:start-:end': 'viewPassage',
        ':surah/:start': 'viewPassage',
        ':surah': 'viewPassage'
    },

    home: doViewPassage.bind(this, 1),
    viewPassage: doViewPassage.bind(this),
    search: doSearch.bind(this)
});

var AppView = Backbone.View.extend({
    el: $('body'),

    initialize: function (client) {
        this.mainView = new MainView(client);
    }
});

var MainView = Backbone.View.extend({
    el: $('#mainPage'),

    events: {
        'click #menuBtn': 'toggleMenu',
        'click .surahRef': 'onSurahClick',
        'click #loginBtn': 'login',
        'submit #searchForm': 'onSearchSubmit',
        'submit #addTagForm': 'onAddTagFormSubmit',
        'click #addTagDialogButton': 'onAddTagFormSubmit',
        'click .tag': 'onTagClick',
        'click span.delete': 'onDelTagClick',
        'click .addTag': 'onAddTagClick',
        'click .recentTag': 'onRecentTagClick'
    },

    initialize: function (client) {
        this.navPanel = $('#nav-panel');
        this.searchBox = $('#search');
        this.addTagPanel = $('#addTagPanel');
        this.addTagForm = $('#addTagForm');
        this.loginRow = $('#loginRow');
        this.client = client;
        this.lastAddedTags = '';

        updateMRU();
        if (client.canLogin) {
            this.loginRow.removeClass('hidden');
        }

        this.bindShortcuts();
        this.loadSurahs();
        
        var self = this;
        $(window).scroll(function () {
            if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
                self.scrollMore();
            }
        });
    },

    scrollMore: function() {
        if (!window.enableAutoScroll ||
                currentSurah == 0 ||
                surahList.length == 0 ||
                window.ayahEnd >= surahList[currentSurah - 1].verses) {
            return;
        }

        window.ayahStart += 50;
        window.ayahEnd = Math.min(window.ayahEnd + 50, surahList[currentSurah - 1].verses);
        loadVerses(currentSurah, window.ayahStart, window.ayahEnd, false);
    },

    onRecentTagClick: function(e) {
        var $this = $(e.currentTarget);
        var $textBox = $('#addTagDialogTextBox');
        var val = $('.tagName', $this).text();
        var existing = $textBox.val();
        if (existing) {
            val = existing + ',' + val;
        }
        $textBox.val(val);
    },

    bindShortcuts: function () {
        var self = this;

        Mousetrap.bind('/', function () {
            self.searchBox.focus();
            return false;
        });
        Mousetrap.bind('q', function () {
            self.navPanel.panel('toggle');
        });
        Mousetrap.bind('l', this.login.bind(this));
        Mousetrap.bind('t', this.onAddTagClick.bind(this, null));
        Mousetrap.bind('d', this.onDelTagClick.bind(this, null));
        Mousetrap.bind('r', this.onRepeatLastTags.bind(this));
        Mousetrap.bind('n', this.nextSurah.bind(this));
        Mousetrap.bind('p', this.previousSurah.bind(this));
    },

    previousSurah: function() {
        if (currentSurah > 1) {
            this.changeSurah(currentSurah - 1);
        }
    },

    nextSurah: function() {
        if (currentSurah > 0 && currentSurah < LastSurah) {
            this.changeSurah(currentSurah + 1);
        }
    },

    loadSurahs: function () {
        var self = this;

        var surahListTemplate = _.template($('#surah_list_template').html());
        surahSelector.change(function () {
            var surah = surahSelector.val();
            self.changeSurah(surah);
        });
        this.client.listSurahs()
                .done(function (result) {
                    surahList = result || [];
                    surahList.forEach(function (surah) {
                        nameSurahMap[surah.name.arabic.toLowerCase()] = surah.id;
                    });
                    surahSelector.append(surahListTemplate({ surahs: surahList }));
                    updateCurrentSurah();
                });
    },

    changeSurah: function(surah) {
        if (surah == 0 || currentSurah == surah) {
            return;
        }

        router.navigate(surah.toString(), { trigger: false });
        doViewPassage(surah);
    },

    onAddTagFormSubmit: function (e) {
        var data = this.addTagForm.data();
        var $textBox = $('#addTagDialogTextBox');
        var tags = $textBox.val();
        var surahNum = data.surah;
        var verseNum = data.verse;
        $textBox.val('');

        this.addTags(surahNum, verseNum, tags);

        $('#addTagPanel').panel('close');
        return false;
    },

    addTags: function (surah, verse, tags) {
        var self = this;
        this.lastAddedTags = tags;

        if (tags != null && tags.length > 0) {
            var values = tags.split(/[,;]/);
            $.each(values, function (i, value) {
                self.addTag(value, surah, verse).done(function (result) {
                    console.log('Successfully Added: ' + result.text);

                    // Update the local row
                    var tagGroup = $('#tags' + surah + '_' + verse);
                    var newTag = verseTagTemplate({
                        tag: result.text,
                        surah: surah,
                        verse: verse
                    });
                    tagGroup.prepend(newTag);
                });
            });
        }
    },

    addTag: function (val, surahNum, verseNum) {
        console.log('Adding tag: ' + val + ' to ' + '[' + surahNum + ':' + verseNum + ']');

        // Add the tag to our recently added tags
        var isInList = false;
        $.each(tagsRecentlyAdded, function (i, entry) {
            if (entry === val) {
                isInList = true;
                return false;
            }
        });

        if (!isInList) {
            tagsRecentlyAdded.unshift(val);
            tagsRecentlyAdded = tagsRecentlyAdded.slice(0, 10);
            updateRecentlyAddedTags();
        }

        return this.client.addTag(surahNum, verseNum, val);
    },

    onRepeatLastTags: function (e) {
        if (!this.client.loggedIn || !this.lastAddedTags) {
            return;
        }

        var data = this.findCurrentVerse(e);
        if (!data || !data.surah || !data.verse) {
            return;
        }

        this.addTags(data.surah, data.verse, this.lastAddedTags);
    },

    findCurrentVerse: function (e) {
        // find the verse currently hovered
        var data = $('.result:hover').first().data();
        if (!data && e && e.currentTarget) {
            data = $(e.currentTarget).closest('.result').data();
        }
        return data;
    },

    onAddTagClick: function (e) {
        if (!this.client.loggedIn) {
            return;
        }

        var data = this.findCurrentVerse(e);
        if (!data || !data.surah || !data.verse) {
            return;
        }

        this.addTagForm.data('surah', data.surah);
        this.addTagForm.data('verse', data.verse);
        $('#addTagRef').text(data.surah + ':' + data.verse);
        var textBox = $('#addTagDialogTextBox').val('');

        this.addTagPanel.panel('open');
        setTimeout(function () {
            textBox.focus();
        }, 500);
    },

    onDelTagClick: function (e) {
        if (!this.client.loggedIn) {
            return false;
        }

        // find the tag currently hovered
        var tagEl = $('li.tag:hover').first();
        if (!tagEl && e && e.currentTarget) {
            tagEl = $(e.currentSurah).closest('li.tag');
        }

        var data = tagEl.data();
        if (!data || !data.tag || !data.surah || !data.verse) {
            return false;
        }

        var parent = tagEl.remove();
        this.deleteTag(data.tag, data.surah, data.verse);

        return false;
    },

    deleteTag: function (val, surahNum, verseNum) {
        console.log('Deleting tag: ' + val + ' to ' + '[' + surahNum + ':' + verseNum + ']');

        this.client.removeTag(surahNum, verseNum, val)
                .done(function () {
                    console.log('Successfully Deleted')
                });
    },

    onTagClick: function (e) {
        var tagEl = $(e.currentTarget);
        if (!tagEl.hasClass('addTag') && !tagEl.hasClass('recentTag')) {
            var tag = tagEl.data('tag');
            onSearch(tag);
        }
    },

    onSearchSubmit: function () {
        var val = this.searchBox.val();
        if (val && val.length > 0) {
            onSearch(val);
        }
        this.searchBox.val('');

        return false;
    },

    toggleMenu: function () {
        this.navPanel.panel('toggle');
    },

    onSurahClick: function (e) {
        var surahRef = $(e.currentTarget);
        var surah = surahRef.data('surah');
        setTimeout(this.changeSurah.bind(this, surah), 1);
    },

    login: function (e) {
        if (!this.client.canLogin) {
            return;
        }

        var self = this;
        client.login('facebook').done(function () {
            self.loginRow.hide();
            self.$el.addClass('loggedin');
        }, function (err) {
            alert('Error: ' + err);
        });
    }
});

$(function () {
    resultTemplate = _.template($('#result_template').html());
    verseTagTemplate = _.template($('#verse_tag_template').html());
    tagListTemplate = _.template($('#tag_list_template').html());
    surahTitleTemplate = _.template($('#surah_title_template').html());
    resultPane = $('#resultsPane');
    mainPageHeading = $('#mainPageHeading');
    surahSelector = $('#surahSelect');
    preText = $('#preText');

    appView = new AppView(client);
    router = new Workspace();
    Backbone.history.start();

    if (Modernizr.localStorage && localStorage.tagsRecentlyAdded) {
        tagsRecentlyAdded = JSON.parse(localStorage.tagsRecentlyAdded);
        updateRecentlyAddedTags();
    }
});

client.onLoading = function (loading) {
    $.mobile.loading(loading ? 'show' : 'hide');
};

function updateMRU() {
    var lastUsedTags = $('#lastUsedTags');
    client.listTags()
          .done(function (tags) {
              lastUsedTags.html(tagListTemplate({
                  tags: tags,
                  classes: ''
              }));
          });
}

function updateRecentlyAddedTags() {
    var container = $('#recentlyAddedTags').html(tagListTemplate({
        tags: tagsRecentlyAdded,
        classes: 'recentTag'
    }));

    if (Modernizr.localStorage) {
        localStorage.tagsRecentlyAdded = JSON.stringify(tagsRecentlyAdded);
    }
}

function onSearch(term) {
    router.navigate('search/' + term, { trigger: false });
    doSearch(term);
}

function doSearch(val) {
    var match = verseNumPattern.exec(val);
    if (match) {
        return doViewPassage(match[1], match[2], match[3]);
    }

    var surah = nameSurahMap[val.toLowerCase()];
    if (surah) {
        return doViewPassage(surah);
    }

    var title = 'tag: ' + val;
    updateTitle(title);
    setCurrentSurah(0);
    window.enableAutoScroll = false;

    console.log('Doing search for: ' + val);
    resultPane.empty();

    client.findVersesByTag(val)
                .done(function (result) {
                    updateTitle(title + ' - ' + result.length + ' result(s)');
                    loadResults(result || [], true);
                });
}

function doViewPassage(surah, ayahStart, ayahEnd) {
    if (surahList.length > 0 && surah > surahList.length) {
        return;
    }

    currentSurah = surah;
    updateCurrentSurah();
    window.enableAutoScroll = true;

    resultPane.empty();
    loadVerses(surah, ayahStart, ayahEnd, true);

    window.ayahStart = ayahStart || 1;
    window.ayahEnd = ayahEnd || 50;
}

function setCurrentSurah(surah) {
    if (surah > 0 && surahList.length > 0 && surahList[surah - 1].bismillah_pre) {
        preText.show();
    }
    else {
        preText.hide();
    }

    surahSelector.val(surah);
    surahSelector.selectmenu('refresh');
    currentSurah = surah;
}

function updateCurrentSurah() {
    setCurrentSurah(currentSurah);
    if (currentSurah > 0 && surahList.length > 0) {
        var surah = surahList[currentSurah - 1];
        var title = surahTitleTemplate(surah);
        updateTitle(title);
    }
}

function updateTitle(title) {
    mainPageHeading.text(title);
}

function loadVerses(surah, start, end, animate) {
    window.loading = true;
    client.getVersesByRange(surah, start, end)
                .done(function (result) {
                    loadResults(result || [], animate);
                });
}

var lastPlayer;
function pausePreviousAudio(e) {
    var self = e.currentTarget;
    if (lastPlayer) {
        if (lastPlayer.pause) {
            lastPlayer.pause();
        }
        $(lastPlayer).css('width', '40px');
    }
    $(self).css('width', '200px');
    lastPlayer = self;
}

function loadResults(data, animate) {
    resultPane.append(resultTemplate({
        data: data,
        tagTemplate: verseTagTemplate
    }));

    if (animate) {
        window.scroll(0, 0);
    }
}