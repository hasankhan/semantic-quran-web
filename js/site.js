var client = new QuranClient('https://semantic-quran.azure-mobile.net/', 'okajHbuHsfhRmylXmwQgOKAsnmUyKG49'),
    tagsMRU = [],
    tagsRecentlyAdded = [],
    context = null;

// Prevents all anchor click handling
$.mobile.linkBindingEnabled = false;

// Disabling this will prevent jQuery Mobile from handling hash changes
$.mobile.hashListeningEnabled = false;

var Workspace = Backbone.Router.extend({
    routes: {
        "": "home",
        "search/:tag": "search",
        ":surah/:start-:end": "view",
        ":surah/:start": "view",
        ":surah": "view"
    },

    home: function () {
        doViewPassage(1);
    },

    view: function (surah, start, end) {
        doViewPassage(surah, start, end);
    },

    search: function (tag) {
        onSearch(tag);
    }

});

var router = new Workspace();
Backbone.history.start();

client.onLoading = function (loading) {
    if (loading) {
        $.mobile.loading('show', {
            theme: $.mobile.loader.prototype.options.theme,
            msgText: 'Loading',
            textVisible: true
        });
    }
    else {
        $.mobile.loading('hide');
    }
};

function doAddTag(val, surahNum, verseNum) {
    console.log("Adding tag: " + val + " to " + "[" + surahNum + ":" + verseNum + "]");

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
    console.log("Deleting tag: " + val + " to " + "[" + surahNum + ":" + verseNum + "]");

    this.client.removeTag(surahNum, verseNum, val)
                .done(function () {
                    console.log("Successfully Deleted")
                });
}

function updateMRU() {
    var container = $('#lastUsedTags').empty();
    $.each(tagsMRU, function (i, tag) {
        var tagElement = $("<li class='tag'></li>").appendTo(container);
        tagElement.append('<span class="tagName">' + tag + '</span>');
    });

    if (typeof (Storage) !== "undefined") {
        localStorage.tagsMRU = JSON.stringify(tagsMRU);
    }
}

function updateRecentlyAddedTags() {
    var container = $('#recentlyAddedTags').empty();
    $.each(tagsRecentlyAdded, function (i, tag) {
        var tagElement = $("<li class='tag recentTag'></li>").appendTo(container);
        tagElement.append('<span class="tagName">' + tag + '</span>');
    });

    if (typeof (Storage) !== "undefined") {
        localStorage.tagsRecentlyAdded = JSON.stringify(tagsRecentlyAdded);
    }
}

function doSearch(tag) {
    router.navigate('search/' + tag, { trigger: true });
}

function onSearch(val) {
    window.lastSurah = null;
    window.enableAutoScroll = false;
    $('#loadMore').hide();

    console.log("Doing search for: " + val);
    var resultPane = $('.resultsPane').empty();

    this.client.findVersesByTag(val)
                .done(function (req) {
                    if (req.result && req.result.length > 0) {
                        loadResults(req.result, true);
                    }
                });

    // Add the search to our recent searches
    var isInList = false;
    $.each(tagsMRU, function (i, entry) {
        if (entry === val) {
            isInList = true;
            return false;
        }
    });

    if (!isInList) {
        tagsMRU.unshift(val);
        tagsMRU = tagsMRU.slice(0, 7);
        updateMRU();
    }
}

function doViewPassage(surah, ayahStart, ayahEnd) {
    window.enableAutoScroll = true;

    var resultPane = $('.resultsPane').empty();
    loadVerses(surah, ayahStart, ayahEnd, true);

    window.surah = surah;
    window.ayahStart = ayahStart || 1;
    window.ayahEnd = ayahEnd || 50;
}

$(function () {
    $(window).scroll(function () {
        if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
            scrollMore();
        }
    });


    var navPanel = $('#nav-panel');
    $('#menuBtn').click(function () {
        navPanel.panel('toggle');
    });

    $('#loadMore').click(scrollMore);

    function scrollMore() {
        if (!window.enableAutoScroll) {
            return;
        }

        window.ayahStart += 50;
        window.ayahEnd += 50;
        loadVerses(window.surah, window.ayahStart, window.ayahEnd, false);
    }
});

function loadVerses(surah, start, end, animate) {
    window.loading = true;
    this.client.getVersesByRange(surah, start, end)
                .done(function (req) {
                    if (req.result && req.result.length > 0) {
                        loadResults(req.result, animate);
                        if (req.result.length < 50) {
                            $('#loadMore').hide();
                        }
                        else {
                            $('#loadMore').show();
                        }
                    }
                });
}

function loadResults(data, animate) {
    $.each(data, function (i, row) {
        var resultPane = $('.resultsPane');
        var result = $('<div class="result">');
        if (animate) {
            result.fadeIn("slow")
        }
        result.appendTo(resultPane);
        var wrapper = $('<div class="ayahWrapper">')
            .appendTo(result);
        var ayahRef = $('<div class="ayahRef"></div>')
            .text('[' + row.surah + ':' + row.verse + ']')
            .appendTo(wrapper);
        var ayah = $('<div class="ayah"></div>')
            .text(row.quran.text)
            .appendTo(wrapper);
        var translation = $('<div class="translation"></div>')
            .text(row.content[0].text)
            .appendTo(wrapper);

        var tagGroup = $('<ul id="tags' + row.surah + '_' + row.verse + '"></ul>')
            .appendTo(result);

        var audioPlayer = $(
            '<audio controls preload="none">' +
                '<source src="' + row.audio.mp3.url + '" type="audio/mpeg">' +
                '<source src="' + row.audio.ogg.url + '" type="audio/ogg">' +
            '</audio>').appendTo(result);

        $("<div class='clear'>").appendTo(result);

        window.lastPlayer;
        audioPlayer.on('play', function () {
            if (window.lastPlayer) {
                if (window.lastPlayer.pause) {
                    window.lastPlayer.pause();
                }
                if (window.lastPlayer[0] && window.lastPlayer[0].pause) {
                    window.lastPlayer[0].pause();
                }
                window.lastPlayer.css('width', '40px');
            }
            window.lastPlayer = $(this)
            window.lastPlayer.css('width', '200px');
        });

        // Add all the tags to the row
        $.each(row.tags, function (j, tag) {
            var tagElement = $("<li class='tag'></li>").prependTo(tagGroup);
            tagElement.append('<span class="tagName">' + tag + '</span>');

            var deleteElement = $('<span class="delete">x</span>')
                .attr("tag", tag)
                .attr("surah", row.surah)
                .attr("verse", row.verse);

            tagElement.append(deleteElement);
        });

        var addButton = $('<li class="addTag"><a href="javascript:void(0)" data-icon="tag" data-iconpos="notext" data-role="button">Add Tag</a></li>');
        tagGroup.append(tagGroup);

        result.attr("surahNum", row.surah)
              .attr("verseNum", row.verse);
    });

    if (animate) {
        window.scroll(0, 0);
    }
}

window.lastSurah = null;
function onSurahChanged() {
    var surah = $("#surahSelect").val();
    if (surah == window.lastSurah) {
        return;
    }
    window.lastSurah = surah;
    router.navigate(surah, { trigger: true });
}

(function initializeSurahDropdowns() {
    var surahSelector = $("#surahSelect");
    surahSelector.click(onSurahChanged);
    this.client.listSurahs()
                .done(function (req) {
                    if (req.result && req.result.length > 0) {
                        surahSelector.empty();
                        req.result.forEach(function (surahData, i) {
                            var surahEntry = $('<option value="' + surahData.id + '">' + surahData.id + ': ' + surahData.name.simple + '</option>').appendTo(surahSelector);
                        });
                    }
                });
})();

$(function () {
    $("body").on("click", ".tag", function () {
        var $this = $(this);

        if (!$this.hasClass("addTag") && !$this.hasClass("recentTag")) {
            var val = $(".tagName", $this).text();
            doSearch(val);
        }
    });

    $("body").on("click", "span.delete", function () {
        var $this = $(this);
        var tag = $this.attr("tag");
        var surah = $this.attr("surah");
        var verse = $this.attr("verse");
        var parent = $this.parent().remove();
        doDeleteTag(tag, surah, verse);

        return false;
    });

    $("#addTagDialogButton").click(function () {
        var $textBox = $("#addTagDialogTextBox");
        var tags = $textBox.val();
        var surahNum = context.attr("surahNum");
        var verseNum = context.attr("verseNum");

        $textBox.val('');

        if (tags != null && tags.length > 0) {
            var values = tags.split(/[,;]/);
            $.each(values, function (i, value) {
                doAddTag(value, surahNum, verseNum).done(function (req) {
                    var val = req.result;
                    console.log("Successfully Added: " + val.text);

                    // Update the local row
                    var tagGroup = $('#tags' + surahNum + '_' + verseNum);
                    var tagElement = $("<li class='tag'></li>").prependTo(tagGroup);
                    tagElement.append('<span class="tagName">' + val.text + '</span>');

                    var deleteElement = $('<span class="delete">x</span>')
                        .attr("tag", val.text)
                        .attr("surah", surahNum)
                        .attr("verse", verseNum);

                    tagElement.append(deleteElement);
                });
            });
        }

        $("#addTagPanel").panel("close");
        return false;
    });

    $("body").on("click", ".addTag", function (event) {

        context = $(this);
        var surahNum = context.attr("surahNum");
        var verseNum = context.attr("verseNum");
        var textBox = $("#addTagDialogTextBox").val("");

        $("#addTagPanel").panel('open');
        setTimeout(function () {
            textBox.focus();
        }, 500);
    });

    $("#recentlyAddedTags").on("click", ".recentTag", function () {
        var $this = $(this);
        var $textBox = $("#addTagDialogTextBox");
        var val = $(".tagName", $this).text();
        var existing = $textBox.val();
        if (existing) {
            val = existing + ',' + val;
        }
        $textBox.val(val);
    });

    $("#searchButton").click(function () {
        var val = $("#search-tag").val();

        if (val && val.length > 0) {
            doSearch(val);
        }
    });

    if (typeof (Storage) !== "undefined") {
        if (localStorage.tagsMRU) {
            tagsMRU = JSON.parse(localStorage.tagsMRU);
            updateMRU();
        }
        if (localStorage.tagsRecentlyAdded) {
            tagsRecentlyAdded = JSON.parse(localStorage.tagsRecentlyAdded);
            updateRecentlyAddedTags();
        }
    }
});
$(function () {
    var loginBtn = $("#login");
    loginBtn.click(function () {
        client.login('facebook').done(function (results) {
            loginBtn.hide();
        }, function (err) {
            alert("Error: " + err);
        });
    });
});