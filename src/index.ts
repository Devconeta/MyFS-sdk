import { Web3Storage } from 'web3.storage';
import { CIDString } from 'web3.storage/dist/src/lib/interface';

interface UploadedFiles {
  newRoot: CIDString;
  uploadedCid: CIDString;
}

export class MyFS {
  private client: Web3Storage;

  constructor(token: string) {
    this.client = new Web3Storage({ token });
  }

  private createUserRoot(address: string, rootIndex: CIDString[]) {
    const blob = new Blob([JSON.stringify(rootIndex)], {
      type: 'application/json',
    });
    return new File([blob], `${address}.json`);
  }

  private async updateUserRoot(
    address: string,
    rootIndex: CIDString[],
    onRootCidReady: (cid: string) => void = () => {},
    onStoredChunk: (size: number) => void = () => {}
  ): Promise<CIDString> {
    return this.client.put([this.createUserRoot(address, rootIndex)], {
      onRootCidReady,
      onStoredChunk,
    });
  }

  async storeFiles(
    address: string,
    files: File[],
    currentRoot: CIDString[],
    onRootCidReady: (cid: string) => void = () => {},
    onStoredChunk: (size: number) => void = () => {}
  ): Promise<UploadedFiles> {
    const uploadedCid = await this.client.put(files, {
      onRootCidReady,
      onStoredChunk,
    });

    const newRoot = await this.updateUserRoot(address, [
      uploadedCid,
      ...currentRoot,
    ]);

    return { newRoot, uploadedCid };
  }
}
