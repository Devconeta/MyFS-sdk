import { Web3Storage } from 'web3.storage';
import { CIDString } from 'web3.storage/dist/src/lib/interface';
import { ethers } from 'ethers';
import abi from './utils/abi';
import { cryptico } from '@daotl/cryptico';

interface UploadedFiles {
  newRoot: CIDString;
  uploadedFiles: UploadedFile[];
}

interface UploadedFile {
  cid: CIDString;
  name: string;
  lastModified: number;
}

export default class MyFS {
  private client: Web3Storage;
  private contract: ethers.Contract;
  private provider: ethers.providers.Web3Provider;

  constructor(_token: string, _provider: ethers.providers.Web3Provider) {
    this.client = new Web3Storage({ token: _token });
    this.provider = _provider;
    this.contract = new ethers.Contract(
      '0xfA020861b01130629c952f29142911674A77d36D',
      abi,
      _provider.getSigner()
    );
  }

  private createUserRoot(address: string, rootIndex: UploadedFile[]) {
    const blob = new Blob([JSON.stringify(rootIndex)], {
      type: 'application/json',
    });
    return new File([blob], `${address}.json`);
  }

  private async encrypt(publicKey: string, file: File) {
    const rsaKey = cryptico.generateRSAKey(publicKey, 1028);
    return (
      cryptico.encrypt(
        this.ab2str(await file.arrayBuffer()),
        publicKey,
        rsaKey
      ) as {
        status: string;
        cipher: string;
      }
    ).cipher;
  }

  private decrypt(privateKey: string, cipher: string): File {
    const rsaKey = cryptico.generateRSAKey(privateKey, 1028);

    const decrypted = cryptico.decrypt(cipher, rsaKey) as any;
    const blob = new Blob([this.str2ab(decrypted.plaintext)]);

    return new File([blob], decrypted.filename);
  }

  private ab2str(buf: ArrayBuffer) {
    return String.fromCharCode.apply(null, new Uint16Array(buf) as any);
  }

  private str2ab(str: string) {
    var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    var bufView = new Uint16Array(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }

  private async updateUserRoot(
    address: string,
    rootIndex: UploadedFile[],
    oldRoot: CIDString | undefined = undefined,
    onRootCidReady: (cid: string) => void = () => {},
    onStoredChunk: (size: number) => void = () => {}
  ): Promise<CIDString> {
    const uploadedCid = await this.client.put(
      [this.createUserRoot(address, rootIndex)],
      {
        onRootCidReady,
        onStoredChunk,
      }
    );

    const transaction = await this.contract.updateRootDirectory(uploadedCid);
    const transactionReceipt = await (
      await this.provider.getSigner().sendTransaction(transaction)
    ).wait();

    if (!transactionReceipt.status) {
      throw {
        message: 'Transaction failed',
        status: transactionReceipt.status,
      };
    }

    if (!!oldRoot) await this.client.delete(oldRoot);

    return uploadedCid;
  }

  async storeFiles(
    address: string,
    files: File[],
    currentRoot: UploadedFile[],
    privateKey: string,
    oldRoot: CIDString | undefined = undefined,
    onRootCidReady: (cid: string) => void = () => {},
    onStoredChunk: (size: number) => void = () => {}
  ): Promise<UploadedFiles> {
    const uploadedFiles: UploadedFile[] = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const content = await this.encrypt(privateKey, files[index]);

      const uploadedCid = await this.client.put(
        [new File([content], file.name)],
        {
          onRootCidReady,
          onStoredChunk,
        }
      );

      uploadedFiles.push({
        cid: uploadedCid,
        name: file.name,
        lastModified: Date.now(),
      });
    }

    const newRoot = await this.updateUserRoot(
      address,
      [...uploadedFiles, ...currentRoot],
      oldRoot
    );

    return { newRoot, uploadedFiles };
  }

  async getFiles(files: UploadedFile[], privateKey: string): Promise<File[]> {
    const results: File[] = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const response = await this.client.get(file.cid).catch(console.log);
      const uploadedFile = (await response?.text()) as any;
      results.push(
        new File([this.decrypt(privateKey, uploadedFile)], file.name)
      );
    }

    return results;
  }

  private async getUserRoot(): Promise<string> {
    return await this.contract.userRoot();
  }

  async getRootIndex(): Promise<UploadedFile[]> {
    const rootIndex = await this.getUserRoot();
    if (!rootIndex) return [];

    const response = await this.client.get(rootIndex).catch(error => {
      throw {
        message: 'Error getting root index',
        error,
      };
    });

    if (!response?.ok) {
      return [];
    }

    const data = (await response?.files())[0];
    const json = JSON.parse(await data.text());

    return json as UploadedFile[];
  }
}
