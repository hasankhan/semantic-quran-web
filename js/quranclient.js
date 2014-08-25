var QuranClient = (function () {

    function QuranClient(host, key) {
        this.client = new WindowsAzure.MobileServiceClient(host, key);
    }

    QuranClient.prototype.addTag = function (surah, verse, tag) {
        this._onLoad();
        return this.client.invokeApi('tag', {
            method: 'post',
            body: {
                surah: surah,
                verse: verse,
                tag: tag
            }
        }).then(this._onSuccess.bind(this), this._onError.bind(this));
    };

    QuranClient.prototype.removeTag = function (surah, verse, tag) {
        this._onLoad();
        return this.client.invokeApi('tag/' + tag + '/' + surah + '/' + verse, {
            method: 'delete'
        }).then(this._onSuccess.bind(this), this._onError.bind(this));
    };

    QuranClient.prototype.findVersesByTag = function (tag) {
        this._onLoad();
        return this.client.invokeApi('tag/' + tag, {
            method: 'get',
        }).then(this._onSuccess.bind(this), this._onError.bind(this));
    };

    QuranClient.prototype.getVersesByRange = function (surah, start, end) {
        var uri = 'verse/' + surah;

        if (start && end) {
            uri += "/" + start + "-" + end;
        }
        else if (start) {
            uri += "/" + start;
        }

        this._onLoad();
        return this.client.invokeApi(uri, {
            method: 'get',
        }).then(this._onSuccess.bind(this), this._onError.bind(this));
    };

    QuranClient.prototype.listSurahs = function () {
        this._onLoad();
        return this.client.invokeApi('surah', {
            method: 'get',
        }).then(this._onSuccess.bind(this), this._onError.bind(this));
    };

    QuranClient.prototype.login = function (provider) {
        this._onLoad();
        return this.client.login("facebook")
                          .then(this._onSuccess.bind(this), this._onError.bind(this));
    };

    QuranClient.prototype._onLoading = function (state) {
        if (typeof this.onLoading === 'function') {
            this.onLoading(state);
        }
    }

    QuranClient.prototype._onSuccess = function (res) {
        this._onLoading(false);
        return res;
    };

    QuranClient.prototype._onError = function (err) {
        this._onLoading(false);
        throw err;
    };

    QuranClient.prototype._onLoad = function () {
        this._onLoading(true);
    };

    return QuranClient;

})();