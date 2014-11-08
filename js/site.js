var client = new QuranClient('https://semantic-quran.azure-mobile.net/', 'okajHbuHsfhRmylXmwQgOKAsnmUyKG49'),
    verseNumPattern = /^(\d{1,3})(?:$|[ :/](\d{1,3})(?:$|-(\d{1,3})$))/,
    appView,
    LastSurah = 114;

// Prevents all anchor click handling
$.mobile.linkBindingEnabled = false;

// Disabling this will prevent jQuery Mobile from handling hash changes
$.mobile.hashListeningEnabled = false;

var Workspace = Backbone.Router.extend({
    routes: {
        '': 'viewPassage',
        'search/:term': 'search',
        ':surah/:start-:end': 'viewPassage',
        ':surah/:start': 'viewPassage',
        ':surah': 'viewPassage',
    },

    viewPassage: function (surah, start, end) {
        appView.mainView.doViewPassage(surah || 1, start, end);
    },

    search: function (term) {
        appView.mainView.doSearch(term);
    }
});

var AppView = Backbone.View.extend({
    el: $('body'),

    initialize: function (client, router) {
        this.mainView = new MainView(client, router);
        router.on('route', function () {
            ga('send', 'pageview', Backbone.history.getFragment());
        });
    }
});

var MainView = Backbone.View.extend({
    el: $('#mainPage'),

    events: {
        'click #menuBtn': 'toggleMenu',
        'click #loginBtn': 'login',
        'submit #searchForm': 'onSearchSubmit',
        'submit #addTagForm': 'onAddTagFormSubmit',
        'click #addTagDialogButton': 'onAddTagFormSubmit',
        'click span.delete': 'onDelTagClick',
        'click .addTag': 'onAddTagClick',
        'click .recentTag': 'onRecentTagClick'
    },

    initialize: function (client, router) {
        this.navPanel = $('#nav-panel');
        this.searchBox = $('#search');
        this.addTagPanel = $('#addTagPanel');
        this.addTagForm = $('#addTagForm');
        this.loginRow = $('#loginRow');
        this.resultTemplate = _.template($('#result_template').html());
        this.verseTagTemplate = _.template($('#verse_tag_template').html());
        this.tagListTemplate = _.template($('#tag_list_template').html());
        this.surahTitleTemplate = _.template($('#surah_title_template').html());
        this.resultPane = $('#resultsPane');
        this.mainPageHeading = $('#mainPageHeading');
        this.surahSelector = $('#surahSelect');
        this.preText = $('#preText');
        this.addTagDialogTextBox = $('#addTagDialogTextBox');
        this.tagsRecentlyAdded = [];
        this.surahList = [];
        this.nameSurahMap = {};
        this.client = client;
        this.router = router;
        this.lastAddedTags = '';

        this.client.onLoading = function (loading) {
            $.mobile.loading(loading ? 'show' : 'hide');
        };
        this.updateMRU();
        this.loadRecentTags();
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

    loadRecentTags: function() {
        if (Modernizr.localstorage && localStorage.tagsRecentlyAdded) {
            this.tagsRecentlyAdded = JSON.parse(localStorage.tagsRecentlyAdded);
            var container = $('#recentlyAddedTags').html(this.tagListTemplate({
                tags: this.tagsRecentlyAdded,
                classes: 'recentTag'
            }));

            localStorage.tagsRecentlyAdded = JSON.stringify(this.tagsRecentlyAdded);
        }
    },

    updateMRU: function () {
        var self = this;
        var lastUsedTags = $('#lastUsedTags');
        client.listTags()
              .done(function (tags) {
                  lastUsedTags.html(self.tagListTemplate({
                      tags: tags,
                      classes: ''
                  }));
              });
    },

    scrollMore: function() {
        if (!this.enableAutoScroll ||
                this.currentSurah == 0 ||
                this.surahList.length == 0 ||
                this.ayahEnd >= this.surahList[this.currentSurah - 1].verses) {
            return;
        }

        this.ayahStart += 50;
        this.ayahEnd = Math.min(this.ayahEnd + 50, this.surahList[this.currentSurah - 1].verses);
        this.loadVerses(this.currentSurah, this.ayahStart, this.ayahEnd, false);
    },

    onRecentTagClick: function(e) {
        var tag = $(e.currentTarget).data('tag');
        var existing = this.addTagDialogTextBox.val();
        if (existing) {
            tag = existing + ',' + tag;
        }
        this.addTagDialogTextBox.val(tag);
        return false;
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
        if (this.currentSurah > 1) {
            this.changeSurah(this.currentSurah - 1);
        }
    },

    nextSurah: function() {
        if (this.currentSurah > 0 && this.currentSurah < LastSurah) {
            this.changeSurah(this.currentSurah + 1);
        }
    },

    loadSurahs: function () {
        var self = this;

        var surahListTemplate = _.template($('#surah_list_template').html());
        this.surahSelector.change(function () {
            var surah = self.surahSelector.val();
            self.changeSurah(surah);
        });
        this.client.listSurahs()
                .done(function (result) {
                    self.surahList = result || [];
                    self.surahList.forEach(function (surah) {
                        self.nameSurahMap[surah.name.arabic.toLowerCase()] = surah.id;
                    });
                    self.surahSelector.append(surahListTemplate({ surahs: self.surahList }));
                    self.updateCurrentSurah();
                });
    },

    changeSurah: function(surah) {
        if (surah == 0 || this.currentSurah == surah) {
            return;
        }

        this.router.navigate(surah.toString(), { trigger: true });
    },

    doViewPassage: function(surah, ayahStart, ayahEnd) {
        if (this.surahList.length > 0 && surah > this.surahList.length) {
            return;
        }

        this.currentSurah = surah;
        this.updateCurrentSurah();
        this.enableAutoScroll = true;

        this.resultPane.empty();
        this.loadVerses(surah, ayahStart, ayahEnd, true);

        this.ayahStart = ayahStart || 1;
        this.ayahEnd = ayahEnd || 50;
    },

    onAddTagFormSubmit: function (e) {
        var data = this.addTagForm.data();
        var tags = this.addTagDialogTextBox.val();
        var surahNum = data.surah;
        var verseNum = data.verse;
        this.addTagDialogTextBox.val('');

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
                    var newTag = self.verseTagTemplate({
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
        $.each(this.tagsRecentlyAdded, function (i, entry) {
            if (entry === val) {
                isInList = true;
                return false;
            }
        });

        if (!isInList) {
            this.tagsRecentlyAdded.unshift(val);
            this.tagsRecentlyAdded = this.tagsRecentlyAdded.slice(0, 10);
            this.loadRecentTags();
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
        var textBox = this.addTagDialogTextBox.val('');

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

    onSearchSubmit: function () {
        var val = this.searchBox.val();
        if (val && val.length > 0) {
            this.router.navigate('search/' + val, { trigger: true });
        }
        this.searchBox.val('');

        return false;
    },

    toggleMenu: function () {
        this.navPanel.panel('toggle');
    },

    login: function (e) {
        if (!this.client.canLogin) {
            return;
        }

        var self = this;
        client.login('facebook', {
            parameters: {
                display: 'popup'
            }
        }).done(function () {
            self.loginRow.hide();
            self.$el.addClass('loggedin');
            UserVoice.push(['identify', {
                id: client.currentUser.userId
            }]);
        }, function (err) {
            alert('Error: ' + err);
        });
    },

    doSearch: function(val) {
        var match = verseNumPattern.exec(val);
        if (match) {
            return this.doViewPassage(match[1], match[2], match[3]);
        }

        var surah = this.nameSurahMap[val.toLowerCase()];
        if (surah) {
            return this.doViewPassage(surah);
        }

        var title = 'tag: ' + val;
        this.updateTitle(title);
        this.setCurrentSurah(0);
        this.enableAutoScroll = false;

        console.log('Doing search for: ' + val);
        this.resultPane.empty();

        var self = this;
        this.client.findVersesByTag(val)
            .done(function (result) {
                self.updateTitle(title + ' - ' + result.length + ' result(s)');
                self.loadResults(result || [], true);
            });
    },

    loadVerses: function(surah, start, end, animate) {
        var self = this;
        this.client.getVersesByRange(surah, start, end)
                .done(function (result) {
                    self.loadResults(result || [], animate);
                });
    },

    updateCurrentSurah: function () {
        this.setCurrentSurah(this.currentSurah);
        if (this.currentSurah > 0 && this.surahList.length > 0) {
            var surah = this.surahList[this.currentSurah - 1];
            var title = this.surahTitleTemplate(surah);
            this.updateTitle(title);
        }
    },

    loadResults: function(data, animate) {
        this.resultPane.append(this.resultTemplate({
            data: data,
            tagTemplate: this.verseTagTemplate
        }));

        if (animate) {
            window.scroll(0, 0);
        }
    },

    updateTitle: function(title) {
        this.mainPageHeading.text(title);
    },

    setCurrentSurah: function(surah) {
        if (surah > 0 && this.surahList.length > 0 && this.surahList[surah - 1].bismillah_pre) {
            this.preText.show();
        }
        else {
            this.preText.hide();
        }

        this.surahSelector.val(surah);
        this.surahSelector.selectmenu('refresh');
        this.currentSurah = surah;
    }
});

$(function () {    
    appView = new AppView(client, new Workspace());
    Backbone.history.start();    
});
