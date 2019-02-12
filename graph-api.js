const fetch = require('node-fetch');
const querystring = require('querystring');

class FB {
  constructor(id, secret, version = 'v3.2') {
    this.id = id;
    this.secret = secret;
    this.version = version;

    this.userToken = {};
    this.applicationToken = {};
    this.getAppToken()
      .then(token => this.applicationToken = token);
  }

  setUserToken(token) {
    this.userToken = token;
  }

  get accessToken() {
    return this.userToken.access_token;
  }

  get appToken() {
    return this.applicationToken.access_token;
  }

  async api(endpoint, options = {}, method = 'GET') {
    const params = {
      method
    };
    if (!options.access_token  && this.accessToken) {
      options.access_token = this.accessToken;
    }
    let query = "";
    if (method === 'POST') {
      params.headers = { 'Content-Type': 'application/json' };
      params.body = JSON.stringify(options);
    } else {
      query = `?${querystring.stringify(options)}`
    }
    //console.log(`https://graph.facebook.com/${this.version}${endpoint}${query}`);
    const req = await fetch(`https://graph.facebook.com/${this.version}${endpoint}${query}`, params);
    const result = await req.json();

    if (result.error) {
      console.log(result.error);
      throw result.error.message;
    }
    return result;
  }

  getAuthDialogUrl(callbackUrl, state, scope = []) {
    //response_type = code|token|code%20token|granted_scopes
    const options = {
      client_id: this.id,
      redirect_uri: callbackUrl
    }

    if (state) {
      options.state = state;
    }

    if (scope.length > 0) {
      options.scope = scope.join(',');
    }

    const query = `?${querystring.stringify(options)}`;
    return `https://www.facebook.com/${this.version}/dialog/oauth${query}`;
  }

  async handleAuth(params) {
    if (params.error) {
      throw params.error_description;
      // Ошибка error_reason / error_description
    } else {
      return this.verifyToken(params);
    }
  }

  async getAppToken() {
    const options = {
      client_id: this.id,
      client_secret: this.secret,
      grant_type: 'client_credentials'
    };
    const token = await this.getToken(options);
    return token;
  }

  async verifyToken(params) {
    const options = {
      client_id: this.id,
      client_secret: this.secret,
      redirect_uri: params.redirect_uri,
      code: params.code
    };
    const token = await this.getToken(options);
    return token;
  }

  async getToken(options) {
    const token = await this.api('/oauth/access_token', options);
    return token;
  }

  async convertToLongLivedToken(shortToken) {
    const options = {
      client_id: this.id,
      client_secret: this.secret,
      grant_type: 'fb_exchange_token',
      fb_exchange_token: shortToken.access_token
    };
    const token = await this.getToken(options);
    return token;
  }

  pageSubscribe(options) {
    options.object = 'page';
    return this.subscribe(options);
  }

  async subscribe(options) {
    options.access_token = this.appToken;
    const result = await this.api(`/${this.id}/subscriptions`, options, 'POST');
    return result;
  }

  async getAccounts(userId) {
    if (!userId) {
      const user = await this.api('/me');
      userId = user.id;
    }
    const result = await this.api(`/${userId}/accounts`);
    return result;
  }

  async pageSubscribe(page, options = {}) {
    options.access_token = page.access_token;
    const result = await this.api(`/${page.id}/subscribed_apps`, options, 'POST');
    return result;
  }

  handleHook({ object, entry }) {
    switch (object) {
      case 'page':
        this.handlePageEvents(entry);
        break;
      default:
        throw 'Unknown object';
    }
  }

  async handlePageEvents(events) {
    events.forEach(({ changes, id, uid, time }) => changes.forEach(async event => await this.handlePageEvent(event, id, uid, time)));
  }

  async handlePageEvent({ field, value }) {
    switch (field) {
      case 'leadgen':
        await this.handlePageLead(value);
        break;
      default:
        throw 'Unknown field';
    }
  }

  async handlePageLead(lead) {
    const info = await this.api(`/${lead.leadgen_id}`);
    const form = await this.api(`/${lead.form_id}`);
    console.log(form, info);
  }
}

module.exports = FB;
