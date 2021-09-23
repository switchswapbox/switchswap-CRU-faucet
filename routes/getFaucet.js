const express = require('express');

const router = express.Router();
const axios = require('axios');

const requiredHashtags = ['#web3', '#ipfs'];

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { typesBundleForPolkadot } = require('@crustio/type-definitions');

const distributedTwitterId = require('../models/distributedTwitterId');

const chainAddr = 'wss://rpc.crust.network';
const wsProvider = new WsProvider(chainAddr);
const FAUCET_AMOUNT = 0.000001 * 10 ** 12;

// Status Code
const DISTRIBUTE_SUCCESS = 0;
const ALREADY_DISTRIBUTED = 1;
const INPUT_NON_VALID = 2;
const UNABLE_FETCH_FROM_TWITTER_ENDPOINT = 3;
const TX_ERROR = 4;
const UNEXPECTED_ERROR = 5;

router.post('/', async (req, res, next) => {
  try {
    const { tweetUrl, crustAddr } = req.body;

    const tweetIdReg = /\/status\/([0-9]+)/;
    const searchTweetId = tweetUrl.match(tweetIdReg);
    let isHashtagsValidated;
    let tweetContent;

    if (searchTweetId) {
      // Get tweet ID
      const tweetId = searchTweetId[1];

      try {
        // 1. Get tweet content
        tweetContent = await axios({
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

        // 2. Validate the tweet
        isHashtagsValidated = requiredHashtags.every((str) => {
          const strReg = new RegExp(str);
          return strReg.test(tweetContent.data.data.text.toLowerCase());
        });
      } catch {
        return res.json({
          statusCode: UNABLE_FETCH_FROM_TWITTER_ENDPOINT,
          statusMsg: 'Twitter URL not found',
        });
      }

      try {
        if (isHashtagsValidated && crustAddr) {
          const isTwitterIdDistributed = await distributedTwitterId.findOne({
            TwitterId: tweetContent.data.data.author_id,
          });

          if (!isTwitterIdDistributed) {
            // 1. Connect to chain
            const chain = new ApiPromise({
              provider: wsProvider,
              typesBundle: typesBundleForPolkadot,
            });
            await chain.isReadyOrError;

            // 2. Get wallet
            const kr = new Keyring({
              type: 'sr25519',
            });
            const krp = kr.addFromUri(process.env.seeds);

            // 3. Send transaction
            const tx = chain.tx.balances.transfer(crustAddr, FAUCET_AMOUNT);
            const txHash = await tx.signAndSend(krp);

            // 4. Register Twitter ID in database
            distributedTwitterId.create({
              TwitterId: tweetContent.data.data.author_id,
            });
            return res.json({
              statusCode: DISTRIBUTE_SUCCESS,
              statusMsg: 'Distributed successfully',
              txHash,
            });
          }
          return res.json({
            statusCode: ALREADY_DISTRIBUTED,
            statusMsg: 'Already distribute',
          });
        }
        return res.json({
          statusCode: INPUT_NON_VALID,
          statusMsg: 'Twitter status or Crust Address non valid',
        });
      } catch (e) {
        return res.json({
          statusCode: TX_ERROR,
          statusMsg: 'TX Error, please verify your address',
        });
      }
    }
    return res.json({ status: 'Twitter URL not correct' });
  } catch (err) {
    res.json({
      statusCode: UNEXPECTED_ERROR,
      statusMsg: err.message,
    });
  }
});

module.exports = router;
