const express = require('express');

const router = express.Router();
const axios = require('axios');

const requiredHashtags = ['#web3', '#ipfs'];

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { typesBundleForPolkadot } = require('@crustio/type-definitions');

const chainAddr = 'wss://rpc.crust.network';
const wsProvider = new WsProvider(chainAddr);

const FAUCET_AMOUNT = 0.000001 * 10 ** 12;

router.post('/', async (req, res, next) => {
  try {
    const { tweetUrl, crustAddr } = req.body;

    const tweetIdReg = /\/status\/([0-9]+)/;
    const searchTweetId = tweetUrl.match(tweetIdReg);
    let isHashtagsValidated;

    if (searchTweetId) {
      const tweetId = searchTweetId[1];

      try {
        const tweetContent = await axios({
          method: 'get',
          url: tweetId,
          baseURL: 'https://api.twitter.com/2/tweets/',
          headers: {
            Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
          },
          params: {
            'tweet.fields': 'author_id',
          },
        });
        isHashtagsValidated = requiredHashtags.every((str) => {
          const strReg = new RegExp(str);
          return strReg.test(tweetContent.data.data.text.toLowerCase());
        });
      } catch {
        throw new Error('The Twitter URL not found');
      }

      try {
        if (isHashtagsValidated && crustAddr) {
          const chain = new ApiPromise({
            provider: wsProvider,
            typesBundle: typesBundleForPolkadot,
          });
          await chain.isReadyOrError;

          const kr = new Keyring({
            type: 'sr25519',
          });

          const krp = kr.addFromUri(process.env.seeds);

          const tx = chain.tx.balances.transfer(crustAddr, FAUCET_AMOUNT);

          const txHash = await tx.signAndSend(krp);
          console.log(txHash.toString());
        }
      } catch {
        throw new Error('TX Error, please verify your address');
      }
    }
    res.send('');
  } catch (err) {
    res.send(err.message);
  }
});

module.exports = router;
