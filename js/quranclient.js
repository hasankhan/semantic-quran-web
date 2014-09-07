var QuranClient = (function () {

    function QuranClient(host, key) {
        this.host = host;

        var clientLoaded = typeof WindowsAzure !== 'undefined' &&
                           typeof WindowsAzure.MobileServiceClient !== 'undefined';

        if (clientLoaded) {
            this.client = new WindowsAzure.MobileServiceClient(host, key);
            this.canLogin = true;
        }

        Object.defineProperty(this, 'loggedIn', {
            get: function () {
                return this.client.currentUser != null;
            }
        });
    }

    QuranClient.prototype.addTag = function (surah, verse, tag) {
        return this._post('tag/' + tag + '/' + surah + '/' + verse);
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

    QuranClient.prototype.listTags = function () {
        return this._get('tag');
    }

    QuranClient.prototype.login = function (provider) {
        if (this.client) {
            return this.client.login(provider);
        }
    };

    QuranClient.prototype._onLoading = function (state) {
        if (typeof this.onLoading === 'function') {
            this.onLoading(state);
        }
    }

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

    QuranClient.prototype._invoke = function (path, settings) {
        this._onLoading(true);

        var url = this.host + 'api/' + path,
            req = {
                type: settings.method.toUpperCase(),
                url: url,
                data: settings.body,
                headers: {}
            };

        if (this.client && this.client.currentUser) {
            req.headers['x-zumo-auth'] = this.client.currentUser.mobileServiceAuthenticationToken;
        }

        var self = this;
        return $.ajax(req).always(function () {
            self._onLoading(false);
        });
    };

    return QuranClient;

})();