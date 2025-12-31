module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Find the source-map-loader rule and configure it to ignore warnings
      const sourceMapLoaderRule = webpackConfig.module.rules.find(
        rule => rule.loader && rule.loader.includes('source-map-loader')
      );
      
      if (sourceMapLoaderRule) {
        sourceMapLoaderRule.exclude = /node_modules\/positioning/;
      }
      
      return webpackConfig;
    },
  },
};
