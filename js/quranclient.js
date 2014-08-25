var QuranClient = (function () {

    function QuranClient(host, key) {
        this.client = new WindowsAzure.MobileServiceClient(host, key);
    }

    QuranClient.prototype.addTag = function (surah, verse, tag) {
        return this._post('tag', {
            surah: surah,
            verse: verse,
            tag: tag
        });
    };

    QuranClient.prototype.removeTag = function (surah, verse, tag) {
        return this._del('tag/' + tag + '/' + surah + '/' + verse);
    };

    QuranClient.prototype.findVersesByTag = function (tag) {
        return this._get('tag/' + tag);
    };

    QuranClient.prototype.getVersesByRange = function (surah, start, end) {
        var path = 'verse/' + surah;

        if (start && end) {
            path += "/" + start + "-" + end;
        }
        else if (start) {
            path += "/" + start;
        }

        return this._get(path);
    };

    QuranClient.prototype.listSurahs = function () {
        return this._get('surah');
    };

    QuranClient.prototype.login = function (provider) {
        this._onLoading(true);
        return this.client.login("facebook")
                          .then(this._onSuccess.bind(this),
                                this._onError.bind(this));
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

    QuranClient.prototype._get = function (path) {
        return this._invoke(path, {
            method: 'get',
        });
    };

    QuranClient.prototype._post = function (path, body) {
        return this._invoke(path, {
            method: 'post',
            body: body
        });
    };

    QuranClient.prototype._del = function (path, body) {
        return this._invoke(path, {
            method: 'delete',
            body: body
        });
    };

    QuranClient.prototype._invoke = function () {
        this._onLoading(true);
        return this.client.invokeApi.apply(this.client, arguments)
                                     .then(this._onSuccess.bind(this),
                                           this._onError.bind(this));
    };

    return QuranClient;

})();