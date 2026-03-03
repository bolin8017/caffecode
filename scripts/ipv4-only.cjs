// Preload script for local development on WSL2.
// WSL2 uses NAT with IPv4 only — IPv6 connections fail silently.
// Node.js fetch (undici) tries IPv6 first via Happy Eyeballs, causing
// Telegram API calls to fail. This forces IPv4-only resolution.
'use strict';
const dns = require('dns');
const net = require('net');
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);
