'use strict'

const RPC = require('@hyperswarm/rpc')
const DHT = require('hyperdht')
const Hypercore = require('hypercore')
const Hyperbee = require('hyperbee')
const crypto = require('crypto')

const main = async () => {
  // hyperbee db
  const hcore = new Hypercore('./db/rpc-server')
  const hbee = new Hyperbee(hcore, { keyEncoding: 'utf-8', valueEncoding: 'binary' })
  await hbee.ready()

  // resolved distributed hash table seed for key pair
  let dhtSeed = (await hbee.get('dht-seed'))?.value
  if (!dhtSeed) {
    // not found, generate and store in db
    dhtSeed = crypto.randomBytes(32)
    await hbee.put('dht-seed', dhtSeed)
  }

  // start distributed hash table, it is used for rpc service discovery
  const dht = new DHT({
    port: 40001,
    keyPair: DHT.keyPair(dhtSeed),
    bootstrap: [{ host: '127.0.0.1', port: 30001 }] // note boostrap points to dht that is started via cli
  })

  // resolve rpc server seed for key pair
  let rpcSeed = (await hbee.get('rpc-seed'))?.value
  if (!rpcSeed) {
    rpcSeed = crypto.randomBytes(32)
    await hbee.put('rpc-seed', rpcSeed)
  }

  // setup rpc server
  const rpc = new RPC({ seed: rpcSeed, dht })
  const rpcServer = rpc.createServer()
  await rpcServer.listen()
  console.log('rpc server started listening on public key:', rpcServer.publicKey.toString('hex'))
  // rpc server started listening on public key: 763cdd329d29dc35326865c4fa9bd33a45fdc2d8d2564b11978ca0d022a44a19

  // bind handlers to rpc server
  rpcServer.respond('ping', async (reqRaw) => {
    // reqRaw is Buffer, we need to parse it
    const req = JSON.parse(reqRaw.toString('utf-8'))

    const resp = { nonce: req.nonce + 1 }

    // we also need to return buffer response
    const respRaw = Buffer.from(JSON.stringify(resp), 'utf-8')
    return respRaw
  })

    const auctions = {};


rpcServer.respond('open-auction', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'));
    auctions[req.auctionId] = {
        id: req.auctionId,
        item: req.item,
        startingPrice: req.startingPrice,
        bids: []
    };
    return Buffer.from(JSON.stringify({ status: 'Auction opened', auctionId: req.auctionId }), 'utf-8');
});

rpcServer.respond('place-bid', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'));
    const auction = auctions[req.auctionId];
    if (auction) {
        auction.bids.push({ bidder: req.bidder, amount: req.amount });
        return Buffer.from(JSON.stringify({ status: 'Bid accepted', auctionId: req.auctionId }), 'utf-8');
    } else {
        return Buffer.from(JSON.stringify({ status: 'Auction not found', auctionId: req.auctionId }), 'utf-8');
    }
});

rpcServer.respond('close-auction', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'));
    const auction = auctions[req.auctionId];
    if (auction) {
        if (auction.bids.length > 0) {
            const winningBid = auction.bids.reduce((max, bid) => (bid.amount > max.amount ? bid : max));
            return Buffer.from(JSON.stringify({ status: 'Auction closed', winningBid }), 'utf-8');
        } else {
            return Buffer.from(JSON.stringify({ status: 'No bids received', auctionId: req.auctionId }), 'utf-8');
        }
    } else {
        return Buffer.from(JSON.stringify({ status: 'Auction not found', auctionId: req.auctionId }), 'utf-8');
    }
});


    // rpcServer.respond('open-auction', async (reqRaw) => {
    //     const req = JSON.parse(reqRaw.toString('utf-8'));
    //     auctions[req.auctionId] = {
    //         item: req.item,
    //         minBid: req.minBid,
    //         bids: [],
    //         status: 'open'
    //     };

    //     return Buffer.from(JSON.stringify({ status: 'Auction opened', auctionId: req.auctionId }), 'utf-8');
    // });

    // rpcServer.respond('place-bid', async (reqRaw) => {
    //     const req = JSON.parse(reqRaw.toString('utf-8'));
    //     const auction = auctions[req.auctionId];
        
    //     if (auction && auction.status === 'open') {
    //         auction.bids.push({ clientId: req.clientId, amount: req.bid });
    //         return Buffer.from(JSON.stringify({ status: 'Bid placed', auctionId: req.auctionId }), 'utf-8');
    //     }

    //     return Buffer.from(JSON.stringify({ status: 'Auction not open or does not exist', auctionId: req.auctionId }), 'utf-8');
    // });

    // rpcServer.respond('close-auction', async (reqRaw) => {
    //     const req = JSON.parse(reqRaw.toString('utf-8'));
    //     const auction = auctions[req.auctionId];
        
    //     if (auction && auction.status === 'open') {
    //         auction.status = 'closed';
    //         const winner = auction.bids.sort((a, b) => b.amount - a.amount)[0];
    //         return Buffer.from(JSON.stringify({ status: 'Auction closed', auctionId: req.auctionId, winner }), 'utf-8');
    //     }

    //     return Buffer.from(JSON.stringify({ status: 'Auction not open or does not exist', auctionId: req.auctionId }), 'utf-8');
    // });

}

main().catch(console.error)