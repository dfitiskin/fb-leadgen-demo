const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const FB = require('./graph-api');


const PORT = process.env.PORT || 3000;
const FB_APP_SUBSCRIPTION_VERIFY_TOKEN = process.env.FB_APP_SUBSCRIPTION_VERIFY_TOKEN;
const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;


const app = express();
const client = new FB(FB_APP_ID, FB_APP_SECRET);

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/user', async (req, res) => {
  const user = await client.api('/me');
  res.json(user);
});


app.get('/signin', (req, res) => {
  const { host } = req.headers;
  const dialogUrl = client.getAuthDialogUrl(`https://${host}/oauth`, 'simple-signin', ['leads_retrieval', 'manage_pages']);
  res.redirect(dialogUrl);
});

app.get('/oauth', async (req, res) => {
  const { host } = req.headers;
  const { query } = req;
  query.redirect_uri = `https://${host}/oauth`;
  try {
    const token = await client.handleAuth(query);
    //const longLivedToken = await client.convertToLongLivedToken(token);
    client.setUserToken(token);
    res.redirect('/pages');
  } catch (error) {
    return res
      .status(500)
      .send(error);
  }
});

app.get('/pages', async (req, res) => {
  const pages = await client.getAccounts();
  res.json(pages);
});


app.get('/unlink', (req, res) => {
  // Удаление приложения
  res.send('Hello World!');
});

app.get('/clear', (req, res) => {
  // Удаление данных
  res.send('Hello World!');
});

app.post('/subscribe', async (req, res) => {
  const { host } = req.headers;
  const options = {
    callback_url: `https://${host}/hook`,
    fields: req.body.fields.join(','),
    verify_token: FB_APP_SUBSCRIPTION_VERIFY_TOKEN
  }
  try {
    const result = client.pageSubscribe(options);
    res.json(result);
  } catch (error) {
    return res
      .status(500)
      .json(error);
  }
});

app.get('/link', async (req, res) => {
  const page = {
    id: '180244941988192',
    access_token: 'EAAFm9TtKHbYBABw4D96ncgRFnpYKDWOKNwfOJQZAQ7r1KqDECnFDZCa6V8ZBSsbh4TVDUkfPEsKfkTuvnkH9ZCnBItcVsQSOxhhiAwaDwpDkrNkcZBBQq9iRZBeWHjc968TVtfEGkm9qRF8IJatUOpo31mZCsqbKHeGAVgn9xWBdwZDZD'
  };
  const options = {
    subscribed_fields: 'leadgen'
  }
  const result = await client.pageSubscribe(page, options);
  res.json(result);
});

app.get('/hook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': verify_token, 'hub.challenge': challenge } = req.query;
  if (mode !== 'subscribe') {
    return res
      .status(500)
      .send('This endpoint only for subscribe hub.mode');
  } else if (!verify_token) {
    return res
      .status(500)
      .send('hub.verify_token is missing');
  } else if (FB_APP_SUBSCRIPTION_VERIFY_TOKEN !== verify_token) {
    return res
      .status(500)
      .send('hub.verify_token is wrong');
  }
  res.send(challenge);
});

app.post('/hook', async (req, res) => {
  try {
    // check X-Hub-Signature
    await client.handleHook(req.body);
    return res.send('Move on!');
  } catch (error) {
    return res
      .status(500)
      .json(error);
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});
