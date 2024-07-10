export class NFTClass {
    
    async get_NFTs(wallet, contractId, account_id) {

        const result = await wallet.viewMethod({
            contractId,
            method: 'nft_tokens_for_owner',
            args: { account_id },
        });
    
        const tokenIds = result.map(item => item.token_id);
        return tokenIds;
    }

    async mint_NFT(wallet, contractId) {
        const storageMethod = {
            method: 'storage_deposit',
            deposit: '20000000000000000000000' // Note deposit amount can be optimised since initial mint requires more deposit than subsequent mints
        };
        const mintMethod = {
            method: 'mint'
        };
        const methods = [storageMethod, mintMethod]

        await wallet.callMultipleMethods({
            contractId,
            methods
        })
    }

}