const NativeModules = require('react-native/Libraries/BatchedBridge/NativeModules');
if (NativeModules && !NativeModules.default) {
  NativeModules.default = NativeModules;
}
if (NativeModules && !NativeModules.SourceCode) {
  NativeModules.SourceCode = {
    getConstants: () => ({
      scriptURL: 'http://localhost:8081/index.bundle',
    }),
  };
}

jest.mock('react-native/Libraries/NativeModules/specs/NativeSourceCode', () => ({
  __esModule: true,
  default: {
    getConstants: () => ({
      scriptURL: 'http://localhost:8081/index.bundle',
    }),
  },
  getConstants: () => ({
    scriptURL: 'http://localhost:8081/index.bundle',
  }),
}));
