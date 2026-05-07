const secretToken = 'e4993c6f16ae536ecdd9fb551ccb72955ffa3cf860f41e5ad1fa10917e6951071be3ec1e609661d5c39b94cf21cb8971f324e0bf0c63bdd14ab322efd96d461c53acd40364ae64b04874cc0526a32ca1c07209dc65a632de896182401761a3d90a54c0efbd420c06e011ae02bbf2d83d4aa16070b1eb6890';

async function testApi() {
    const loginUrl = 'https://api-admin.billz.ai/v1/auth/login';
    
    console.log('Authenticating...');
    try {
        const loginRes = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                secret_token: secretToken
            })
        });
        
        const loginData = await loginRes.json();
        
        if (loginRes.ok && loginData.code === 200) {
            console.log('Login successful!');
            const accessToken = loginData.data.access_token;
            
            console.log('\nTrying to fetch products...');
            
            // Fetch products with a larger limit to get more items
            const productsUrl = 'https://api-admin.billz.ai/v2/products?limit=500';
            const productsRes = await fetch(productsUrl, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            console.log(`Products Status: ${productsRes.status}`);
            if (productsRes.ok) {
                const productsData = await productsRes.json();
                console.log(`Successfully fetched ${productsData.products.length} products total.`);
                
                // Filter by category or name containing 'Тахта', 'Lipa', 'Olxa'
                const targetProducts = productsData.products.filter(product => {
                    const categoryNames = product.categories ? product.categories.map(c => c.name.toLowerCase()).join(' ') : '';
                    const brandName = product.brand_name ? product.brand_name.toLowerCase() : '';
                    const productName = product.name ? product.name.toLowerCase() : '';
                    
                    const isTaxta = categoryNames.includes('тахта') || productName.includes('тахта') || productName.includes('вагонка');
                    const isLipa = brandName.includes('lipa') || brandName.includes('липа') || productName.includes('липа');
                    const isOlxa = brandName.includes('olxa') || brandName.includes('ольха') || productName.includes('ольха');
                    
                    // We match if it is Taxta AND (Lipa or Olxa), or just broad check for testing
                    return isTaxta || isLipa || isOlxa;
                });

                console.log(`Found ${targetProducts.length} target products (Lipa/Olxa Taxta):`);
                
                targetProducts.forEach(product => {
                    let totalStock = 0;
                    if (product.shop_measurement_values && product.shop_measurement_values.length > 0) {
                        product.shop_measurement_values.forEach(shop => {
                            totalStock += shop.active_measurement_value || 0;
                        });
                    }
                    console.log(`\n- Nome: ${product.name}`);
                    console.log(`  Brend: ${product.brand_name || 'N/A'}, Kategoriyasi: ${product.categories.map(c => c.name).join(', ')}`);
                    console.log(`  Qoldiq: ${totalStock} ta`);
                });
                
            } else {
                const errorData = await productsRes.text();
                console.log('Error fetching products:', errorData);
            }
            
        } else {
            console.error('Login failed:', loginData);
        }
    } catch(e) {
        console.error(`Request failed: ${e.message}`);
    }
}

testApi();
