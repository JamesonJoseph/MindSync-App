const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'mp4');
config.resolver.assetExts.push('mp4', 'mov', 'avi', 'webm', 'mkv');

module.exports = config;
