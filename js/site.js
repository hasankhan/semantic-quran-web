var client = new QuranClient('https://semantic-quran.azure-mobile.net/', 'okajHbuHsfhRmylXmwQgOKAsnmUyKG49'),
    tagsRecentlyAdded = [],
    resultTemplate,
    tagListTemplate,
    verseTagTemplate,
    surahTitleTemplate,
    resultPane,
    router,
    mainView,
    currentSurah,
    mainPageHeading,
    surahList = [];

// Prevents all anchor click handling
$.mobile.linkBindingEnabled = false;

// Disabling this will prevent jQuery Mobile from handling hash changes
$.mobile.hashListeningEnabled = false;

var Workspace = Backbone.Router.extend({
    routes: {
        '': 'home',
        'search/:tag': 'search',
        ':surah/:start-:end': 'viewPassage',
        ':surah/:start': 'viewPassage',
        ':surah': 'viewPassage'
    },

    home: doViewPassage.bind(this, 1),
    viewPassage: doViewPassage.bind(this),
    search: doSearch.bind(this)
});

var MainView = Backbone.View.extend({
    el: $('#mainPage'),

    events: {
        'click #menuBtn': 'toggleMenu',
        'click .surahRef': 'changeSurah',
        'click #loginBtn': 'login',
        'submit #searchForm': 'onSearchSubmit',
    },

    initialize: function () {
        this.navPanel = $('#nav-panel');
        this.searchBox = $('#search');
        updateMRU();
        if (client.canLogin) {
            $('#loginRow').removeClass('hidden');
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

    changeSurah: function (e) {
        var surahRef = $(e.target);
        var surah = surahRef.data('surah');
        setTimeout(changeSurah.bind(null, surah), 1);
    },

    login: function (e) {
        var self = this;
        client.login('facebook').done(function () {
            $(e.target).hide();
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
    resultPane = $('.resultsPane');
    mainPageHeading = $('#mainPageHeading');

    mainView = new MainView();
    router = new Workspace();
    Backbone.history.start();

    $(window).scroll(function () {
        if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
            scrollMore();
        }
    });

    $('#addTagForm').submit(function () {
        $('#addTagDialogButton').click();
        return false;
    });

    var $body = $('body');
    $body.on('click', '.tag', function () {
        var $this = $(this);

        if (!$this.hasClass('addTag') && !$this.hasClass('recentTag')) {
            var tag = $this.data('tag');
            onSearch(tag);
        }
    });

    $body.on('click', 'span.delete', function () {
        var $this = $(this);
        var data = $this.data();
        var parent = $this.parent().remove();
        doDeleteTag(data.tag, data.surah, data.verse);

        return false;
    });

    $('#addTagDialogButton').click(function () {
        var data = $('#addTagForm').data();
        var $textBox = $('#addTagDialogTextBox');
        var tags = $textBox.val();
        var surahNum = data.surah;
        var verseNum = data.verse;

        $textBox.val('');

        if (tags != null && tags.length > 0) {
            var values = tags.split(/[,;]/);
            $.each(values, function (i, value) {
                doAddTag(value, surahNum, verseNum).done(function (result) {
                    console.log('Successfully Added: ' + result.text);

                    // Update the local row
                    var tagGroup = $('#tags' + surahNum + '_' + verseNum);
                    var newTag = verseTagTemplate({
                        tag: result.text,
                        surah: surahNum,
                        verse: verseNum
                    });
                    tagGroup.prepend(newTag);
                });
            });
        }

        $('#addTagPanel').panel('close');
        return false;
    });

    $body.on('click', '.addTag', function (event) {
        var data = $(this).data();

        var form = $('#addTagForm');
        form.data('surah', data.surah);
        form.data('verse', data.verse);

        var textBox = $('#addTagDialogTextBox').val('');

        $('#addTagPanel').panel('open');
        setTimeout(function () {
            textBox.focus();
        }, 500);
    });

    $('#recentlyAddedTags').on('click', '.recentTag', function () {
        var $this = $(this);
        var $textBox = $('#addTagDialogTextBox');
        var val = $('.tagName', $this).text();
        var existing = $textBox.val();
        if (existing) {
            val = existing + ',' + val;
        }
        $textBox.val(val);
    });

    if (Modernizr.localStorage && localStorage.tagsRecentlyAdded) {
        tagsRecentlyAdded = JSON.parse(localStorage.tagsRecentlyAdded);
        updateRecentlyAddedTags();
    }

    var surahSelector = $('#surahSelect');
    var surahListTemplate = _.template($('#surah_list_template').html());
    surahSelector.click(onSurahChanged);
    client.listSurahs()
            .done(function (result) {
                surahList = result || [];
                updateSurahTitle();
                surahSelector.html(surahListTemplate({ surahs: surahList }));
            });
});

client.onLoading = function (loading) {
    $.mobile.loading(loading ? 'show' : 'hide');
};

function doAddTag(val, surahNum, verseNum) {
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

    return client.addTag(surahNum, verseNum, val);
}

function doDeleteTag(val, surahNum, verseNum) {
    console.log('Deleting tag: ' + val + ' to ' + '[' + surahNum + ':' + verseNum + ']');

    client.removeTag(surahNum, verseNum, val)
            .done(function () {
                console.log('Successfully Deleted')
            });
}

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

function onSearch(tag) {
    router.navigate('search/' + tag, { trigger: false });
    doSearch(tag);
}

function doSearch(val) {
    updateTitle('tag: ' + val);
    currentSurah = 0;
    window.enableAutoScroll = false;

    console.log('Doing search for: ' + val);
    var resultPane = $('.resultsPane').empty();

    client.findVersesByTag(val)
                .done(function (result) {
                    loadResults(result || [], true);
                });
}

function doViewPassage(surah, ayahStart, ayahEnd) {
    if (surahList.length > 0 && surah >= surahList.length) {
        return;
    }

    currentSurah = surah;
    updateSurahTitle();
    window.enableAutoScroll = true;

    var resultPane = $('.resultsPane').empty();
    loadVerses(surah, ayahStart, ayahEnd, true);

    window.ayahStart = ayahStart || 1;
    window.ayahEnd = ayahEnd || 50;
}

function updateSurahTitle() {
    if (currentSurah > 0 && surahList.length > 0) {
        var surah = surahList[currentSurah - 1];
        var title = surahTitleTemplate(surah);
        updateTitle(title);
    }
}

function updateTitle(title) {
    mainPageHeading.text(title);
}

function scrollMore() {
    if (!window.enableAutoScroll ||
        currentSurah == 0 ||
        surahList.length == 0 ||
        window.ayahEnd >= surahList[currentSurah - 1].verses) {
        return;
    }

    window.ayahStart += 50;
    window.ayahEnd = Math.min(window.ayahEnd + 50, surahList[currentSurah - 1].verses);
    loadVerses(currentSurah, window.ayahStart, window.ayahEnd, false);
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
    var self = e.target;
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

function onSurahChanged() {
    var surah = $('#surahSelect').val();
    changeSurah(surah);
}

function changeSurah(surah) {
    if (currentSurah == surah) {
        return;
    }

    router.navigate(surah.toString(), { trigger: false });
    doViewPassage(surah);
}