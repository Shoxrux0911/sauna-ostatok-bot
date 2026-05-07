const secretToken = 'e4993c6f16ae536ecdd9fb551ccb72955ffa3cf860f41e5ad1fa10917e6951071be3ec1e609661d5c39b94cf21cb8971f324e0bf0c63bdd14ab322efd96d461c53acd40364ae64b04874cc0526a32ca1c07209dc65a632de896182401761a3d90a54c0efbd420c06e011ae02bbf2d83d4aa16070b1eb6890';

async function diagnose() {
    const loginUrl = 'https://api-admin.billz.ai/v1/auth/login';
    
    try {
        const loginRes = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret_token: secretToken })
        });
        
        const loginData = await loginRes.json();
        const accessToken = loginData.data.access_token;
        
        const productsUrl = 'https://api-admin.billz.ai/v2/products?limit=1000';
        const productsRes = await fetch(productsUrl, {
            method: 'GET',
            headers: { 'accept': 'application/json', 'Authorization': `Bearer ${accessToken}` }
        });
        
        const productsData = await productsRes.json();
        
        console.log('--- ALL POLOK PRODUCTS ---');
        productsData.products.forEach(p => {
            const name = p.name || '';
            const brand = p.brand_name || '';
            const cats = p.categories ? p.categories.map(c => c.name).join(', ') : 'N/A';
            
            if (name.toLowerCase().includes('полок') || name.toLowerCase().includes('polok')) {
                console.log(`Product: "${name}" | Brand: "${brand}" | Categories: [${cats}]`);
            }
        });
    } catch (e) {
        console.error(e);
    }
}

diagnose();
