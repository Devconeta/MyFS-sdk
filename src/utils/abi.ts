export default [
  {
    inputs: [
      {
        internalType: 'string',
        name: '_rootDirData',
        type: 'string',
      },
    ],
    name: 'updateRootDirectory',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'userRoot',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
