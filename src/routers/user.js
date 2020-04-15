const express = require('express');
const router = new express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user');
const {
  sendWelcomeEmail,
  sendCancelationAccountEmail,
  sendPasswordResetEmail,
} = require('../emails/account');

router.post('/users', async (req, res) => {
  const user = new User(req.body);

  try {
    await user.save();
    sendWelcomeEmail(user.email, user.username); // don't await here, let it be asynchronized
    const token = await user.generateAuthToken();
    res.status(201).send({ user, token });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.post('/users/login', async (req, res) => {
  try {
    const user = await User.findByCredentials(
      req.body.email,
      req.body.password
    );
    const token = await user.generateAuthToken();

    res.send({ user, token });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

/*
      Password Reset
*/
router.post('/users/passwordReset', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      // Better not provide more specific info to decrease the security
      throw new Error('Unable to find your account');
    }

    const passwordGenerator = Math.random().toString(36).slice(2);
    console.log(passwordGenerator);
    user.password = passwordGenerator;
    user.confirmedPassword = user.password;
    await user.save();
    sendPasswordResetEmail(user.email, user.username, passwordGenerator);

    res.send({ user });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.post('/users/logout', auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(
      (token) => token.token !== req.token
    );
    await req.user.save();
    res.send();
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

router.post('/users/logoutAll', auth, async (req, res) => {
  try {
    req.user.tokens = [];
    await req.user.save();
    res.send();
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

router.get('/users/me', auth, async (req, res) => {
  res.send(req.user);
});

router.get('/users/:id', auth, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id });
    if (!user) res.status(404).send();
    res.send(user);
  } catch (e) {
    res.status(500).send();
  }
});

router.patch('/users/me', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = [
    'firstName',
    'lastName',
    'username',
    'email',
    'password',
    'confirmedPassword',
  ];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation)
    return res.status(400).send({ error: 'Invalid updates!' });
  try {
    updates.forEach((update) => (req.user[update] = req.body[update]));
    await req.user.save();
    res.send(req.user);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

router.delete('/users/me', auth, async (req, res) => {
  try {
    await req.user.remove();
    sendCancelationAccountEmail(req.user.email, req.user.username);
    res.send(req.user);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

module.exports = router;
