// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
// User provided Config
const firebaseConfig = {
  apiKey: "AIzaSyCXCO9zBeFcIUSqr4560dhvhsB6ASw7mH4",
  authDomain: "luxestore-6e971.firebaseapp.com",
  databaseURL: "https://luxestore-6e971-default-rtdb.firebaseio.com",
  projectId: "luxestore-6e971",
  storageBucket: "luxestore-6e971.firebasestorage.app",
  messagingSenderId: "855513072694",
  appId: "1:855513072694:web:b8526f6b10106c55b78497",
  measurementId: "G-38K8JKMQJ4"
};

let db = null;
let auth = null;
let useFirebase = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    auth = firebase.auth();
    useFirebase = true;
    console.log("🔥 Firebase Connected Successfully!");
} catch(e) {
    console.log("⚠️ Firebase Error: ", e.message);
}

// ==========================================
// 2. STATE & DATA INITIALIZATION
// ==========================================
const placeholderImgs = [
    "https://images.unsplash.com/photo-1596755094514-f87e32f85e98?q=80&w=600", // Shirt
    "https://images.unsplash.com/photo-1624378439575-d1ead6bb17f2?q=80&w=600", // Pant
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600", // Shoe
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=600", // Watch
    "https://images.unsplash.com/photo-1628151515664-92d6e326be8e?q=80&w=600", // Belt
    "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=600", // Ear Buds
    "https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=600", // Glasses
    "https://images.unsplash.com/photo-1601593346740-925612772716?q=80&w=600"  // Mobile Cover
];

const expandedCategories = [
    "Men Shirts", "Men Pants", "Men Trousers", "Men Shoes", 
    "Women Shirts", "Women Pants", "Women Trousers", "Women Shoes",
    "Watches", "Belts", "Handfrees", "Ear Buds", "Glasses", "Gorilla Glass", "Mobile Covers"
];

let allProducts = [];
let cart = [];
let orders = [];
let discount = 0, spins = 0, notifs = [];
let currentCategory = "All";
let currentUser = null; 

// --- LOAD DATA & AUTH STATE ---
window.onload = () => { 
    if(useFirebase) {
        
        // Listen to Auth State
        auth.onAuthStateChanged((user) => {
            currentUser = user;
            updateAuthUI();
            
            // Fetch their specific orders
            if(user) fetchCustomerOrders(user.email);
        });

        // Fetch Products from Firebase
        db.ref('products').on('value', snapshot => {
            const data = snapshot.val();
            if(data) {
                allProducts = Object.keys(data).map(key => ({...data[key], dbKey: key}));
            } else {
                seedDefaultProducts();
            }
            applyFilters();
            renderAdminProducts(); 
        });

        // Fetch Orders for Admin from Firebase
        db.ref('orders').on('value', snapshot => {
            const data = snapshot.val();
            if(data) {
                orders = Object.keys(data).map(key => ({...data[key], dbKey: key})).reverse();
                updateAdminOrders();
                if(currentUser) fetchCustomerOrders(currentUser.email); 
            }
        });
    }

    drawWheel(); 
    reveal(); 
    window.addEventListener('scroll', reveal); 
    
    setTimeout(() => {
        document.getElementById('loader-wrapper').style.opacity = '0';
        setTimeout(() => document.getElementById('loader-wrapper').style.display = 'none', 600);
    }, 800); 
    
    setTimeout(() => {
        document.getElementById('auth-container').classList.add('sign-in')
    }, 200);
};

function seedDefaultProducts() {
    allProducts = Array.from({ length: 30 }, (_, i) => {
        let cat = expandedCategories[i % expandedCategories.length];
        return {
            id: Date.now() + i,
            name: `Premium ${cat} Model ${i+1}`,
            price: 1500 + (Math.floor(Math.random() * 80) * 100),
            img: placeholderImgs[i % placeholderImgs.length],
            cat: cat
        };
    });
    if(useFirebase) allProducts.forEach(p => db.ref('products').push(p));
}

// ==========================================
// 3. UI & PRODUCT RENDERING
// ==========================================
function reveal() {
    document.querySelectorAll(".reveal").forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight - 50) el.classList.add("active");
    });
}

function renderProducts(data) {
    const grid = document.getElementById('product-grid');
    if(data.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-20"><i class="fa-solid fa-box-open text-4xl text-slate-300 mb-4"></i><p class="text-slate-500 font-bold">No products found.</p></div>`;
        return;
    }
    
    grid.innerHTML = data.map(p => `
        <div class="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-orange-100 transition-all duration-300 group reveal active">
            <div class="overflow-hidden rounded-[1.5rem] mb-5 h-56 bg-slate-50 relative">
                <img src="${p.img}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                <div class="absolute top-3 left-3 bg-white/90 backdrop-blur text-[9px] font-black text-slate-800 px-3 py-1 rounded-full shadow-sm">${p.cat}</div>
            </div>
            <div class="flex flex-col gap-1 mb-5">
                <h3 class="font-bold text-sm text-slate-800 line-clamp-1 group-hover:text-orange-600 transition-colors">${p.name}</h3>
                <span class="text-slate-900 font-black text-lg">Rs. ${p.price.toLocaleString()}</span>
            </div>
            <button onclick="flyToCart(event, ${p.id})" class="w-full bg-slate-50 border border-slate-100 text-slate-900 py-3.5 rounded-2xl font-black text-xs hover:bg-slate-900 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2 group-hover:border-slate-900">
                <i class="fa-solid fa-cart-plus"></i> ADD TO BAG
            </button>
        </div>
    `).join('');
}

// --- SEARCH & FILTER LOGIC ---
function filterByCategory(cat) {
    currentCategory = cat;
    document.getElementById('current-category-label').innerText = cat === "All" ? "Showing All Accessories & Clothing" : `Category: ${cat}`;
    document.getElementById('hero-search').value = ""; 
    applyFilters();
    document.getElementById('products').scrollIntoView();
}

function filterItemsFromHero() {
    currentCategory = "All";
    document.getElementById('current-category-label').innerText = "Search Results";
    applyFilters();
}

function applyFilters() {
    let searchVal = document.getElementById('hero-search') ? document.getElementById('hero-search').value.toLowerCase() : "";
    let sort = document.getElementById('sort-logic').value;
    
    let filtered = [...allProducts];
    
    if (currentCategory !== "All") filtered = filtered.filter(p => p.cat === currentCategory);
    if (searchVal) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal) || p.cat.toLowerCase().includes(searchVal));
    
    if(sort === 'low') filtered.sort((a,b) => a.price - b.price);
    if(sort === 'high') filtered.sort((a,b) => b.price - a.price);
    
    renderProducts(filtered);
    
    if(searchVal && window.scrollY < document.getElementById('products').offsetTop - 100) {
        document.getElementById('products').scrollIntoView();
    }
}

// ==========================================
// 4. USER AUTHENTICATION & LOGIN UI
// ==========================================

function toggleAuth() {
    const container = document.getElementById('auth-container');
    container.classList.toggle('sign-in');
    container.classList.toggle('sign-up');
}

function openAuthModal() {
    if(currentUser) return; 
    document.getElementById('authModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Handle Sign Up
document.getElementById('signup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!useFirebase) return alert("Firebase not connected!");
    
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    
    auth.createUserWithEmailAndPassword(email, pass)
        .then(cred => {
            return cred.user.updateProfile({ displayName: name });
        })
        .then(() => {
            alert("Account created successfully!");
            closeAuthModal();
        })
        .catch(err => alert("Error: " + err.message));
});

// Handle Sign In
document.getElementById('signin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!useFirebase) return alert("Firebase not connected!");
    
    const email = document.getElementById('log-email').value;
    const pass = document.getElementById('log-pass').value;
    
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            alert("Logged in successfully!");
            closeAuthModal();
        })
        .catch(err => alert("Error: " + err.message));
});

function logoutUser() {
    if(confirm("Are you sure you want to logout?")) {
        auth.signOut().then(() => {
            alert("Logged out.");
            document.getElementById('my-orders-section').classList.add('hidden');
        });
    }
}

// Update Navbar UI based on Auth state
function updateAuthUI() {
    const loginBtn = document.getElementById('nav-login-btn');
    const userProfile = document.getElementById('nav-user-profile');
    const userName = document.getElementById('nav-user-name');
    const orderLinks = document.querySelectorAll('.user-only');

    if(currentUser) {
        loginBtn.classList.add('hidden');
        userProfile.classList.remove('hidden');
        userName.innerText = `Hi, ${currentUser.displayName || 'User'}`;
        orderLinks.forEach(l => l.classList.remove('hidden'));
        
        if(document.getElementById('cust-name')) document.getElementById('cust-name').value = currentUser.displayName || '';
    } else {
        loginBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
        orderLinks.forEach(l => l.classList.add('hidden'));
    }
}

// Show specific customer orders
function showMyOrders() {
    if(!currentUser) return openAuthModal();
    document.getElementById('my-orders-section').classList.remove('hidden');
    document.getElementById('my-orders-section').scrollIntoView();
}

function fetchCustomerOrders(email) {
    const customerOrders = orders.filter(o => o.email === email);
    const list = document.getElementById('customer-orders-list');
    
    if(customerOrders.length === 0) {
        list.innerHTML = `<div class="bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm text-center"><p class="text-slate-500 font-bold">You haven't placed any orders yet.</p></div>`;
        return;
    }
    
    list.innerHTML = customerOrders.map(o => `
        <div class="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between gap-6 hover:shadow-md transition-shadow">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <span class="bg-${o.status === 'Completed' ? 'emerald' : 'blue'}-100 text-${o.status === 'Completed' ? 'emerald' : 'blue'}-600 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest">${o.status || 'Processing'}</span>
                    <h4 class="font-black text-lg text-slate-900">Order #${o.id}</h4>
                </div>
                <p class="text-sm font-bold text-slate-500 mb-1"><i class="fa-regular fa-clock mr-1"></i> ${o.date}</p>
                <p class="text-xs text-slate-500 max-w-sm"><i class="fa-solid fa-location-dot mr-1"></i> ${o.city}, ${o.address}</p>
            </div>
            <div class="md:text-right flex flex-col justify-between">
                <p class="font-black text-2xl text-slate-900 mb-2">${o.total}</p>
                <button onclick='alert("Items:\\n\\n${o.items.map(i=> "- " + i.name + " (Rs." + i.price + ")").join('\\n')}")' class="text-xs font-bold text-orange-600 hover:text-orange-700 uppercase tracking-widest">View Items <i class="fa-solid fa-arrow-right text-[10px] ml-1"></i></button>
            </div>
        </div>
    `).join('');
}


// ==========================================
// 5. CART & CHECKOUT LOGIC
// ==========================================
function flyToCart(e, id) {
    const p = allProducts.find(x => x.id === id);
    cart.push({...p, cartId: Date.now()});
    
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const target = document.getElementById('cart-target').getBoundingClientRect();
    
    const flyer = document.createElement('div');
    flyer.className = 'flyer flex items-center justify-center text-white';
    flyer.innerHTML = '<i class="fa-solid fa-bag-shopping text-sm"></i>';
    flyer.style.left = rect.left + (rect.width/2) - 20 + 'px';
    flyer.style.top = rect.top + 'px';
    flyer.style.setProperty('--tx', `${target.left - rect.left - (rect.width/2) + 20}px`);
    flyer.style.setProperty('--ty', `${target.top - rect.top}px`);
    document.body.appendChild(flyer);
    
    setTimeout(() => {
        flyer.remove();
        document.getElementById('cart-count').innerText = cart.length;
        document.getElementById('cart-target').classList.add('scale-110');
        setTimeout(() => document.getElementById('cart-target').classList.remove('scale-110'), 200);
        pushNotif(`Added <span class="text-orange-600">${p.name}</span> to bag`);
    }, 800);
}

function openCart() { 
    if(cart.length) { 
        updateCartUI(); 
        openModal('cart-modal'); 
    } else {
        pushNotif("Your shopping bag is empty!");
        document.getElementById('notif-sidebar').classList.add('open');
    }
}

function updateCartUI() {
    let sub = 0;
    document.getElementById('cart-items').innerHTML = cart.map(i => {
        sub += i.price;
        return `<div class="flex justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 items-center gap-4 hover:border-orange-200 transition-colors">
            <div class="w-16 h-16 rounded-xl overflow-hidden bg-white shrink-0"><img src="${i.img}" class="w-full h-full object-cover"></div>
            <div class="flex-1"><p class="font-bold text-sm text-slate-800 line-clamp-1">${i.name}</p><p class="text-slate-500 text-xs font-medium">${i.cat}</p><p class="text-orange-600 text-sm font-black mt-1">Rs. ${i.price.toLocaleString()}</p></div>
            <button onclick="removeCart(${i.cartId})" class="w-10 h-10 bg-white rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 shadow-sm transition-all"><i class="fa-solid fa-trash-can"></i></button>
        </div>`;
    }).join('');
    
    let discountVal = parseInt(discount) || 0;
    let discountAmount = sub * (discountVal/100);
    let total = sub - discountAmount;
    
    document.getElementById('sub-total').innerText = "Rs. " + sub.toLocaleString();
    document.getElementById('disc-val').innerText = discount || "0%";
    document.getElementById('total-val').innerText = "Rs. " + Math.round(total).toLocaleString();
}

function removeCart(cid) { 
    cart = cart.filter(i => i.cartId !== cid); 
    updateCartUI(); 
    document.getElementById('cart-count').innerText = cart.length; 
    if(!cart.length) closeModal('cart-modal'); 
}

async function submitOrder() {
    const n = document.getElementById('cust-name').value;
    const p = document.getElementById('cust-phone').value;
    const city = document.getElementById('cust-city').value;
    const address = document.getElementById('cust-address').value;
    
    if(!n || !p || !city || !address) return alert("Please fill all shipping details correctly.");
    
    const order = { 
        id: 'LX-'+Math.floor(Math.random()*99999), 
        customer: n, 
        phone: p, 
        city: city,
        address: address,
        email: currentUser ? currentUser.email : "Guest", 
        items: [...cart], 
        total: document.getElementById('total-val').innerText, 
        date: new Date().toLocaleString(),
        status: "Processing" 
    };
    
    if(useFirebase) {
        db.ref('orders').push(order);
    }
    
    await getReceipt(order);
    pushNotif(`Order <strong class="text-slate-900">${order.id}</strong> placed!`);
    
    cart = []; document.getElementById('cart-count').innerText = "0"; 
    document.getElementById('cust-name').value = ""; document.getElementById('cust-phone').value = "";
    document.getElementById('cust-address').value = ""; document.getElementById('cust-city').value = "";
    discount = 0; closeModal('cart-modal');
}

async function getReceipt(o) {
    const body = document.getElementById('receipt-body');
    body.innerHTML = `
        <strong>ORDER NO:</strong> #${o.id}<br>
        <strong>DATE:</strong> ${o.date}<br>
        <strong>CUSTOMER:</strong> ${o.customer}<br>
        <strong>PHONE:</strong> ${o.phone}<br>
        <strong>DELIVERY:</strong> ${o.city}, ${o.address}<br>
        <hr style="border:1px dashed #ccc; margin:15px 0">
        <table style="width:100%; text-align:left;">
            <tr><th>Item</th><th style="text-align:right">Price</th></tr>
            ${o.items.map(i => `<tr><td style="padding:5px 0; border-bottom:1px solid #eee;">${i.name.substring(0,18)}...</td><td style="text-align:right; border-bottom:1px solid #eee;">Rs.${i.price}</td></tr>`).join('')}
        </table>
    `;
    document.getElementById('receipt-sum').innerText = "AMOUNT PAID: " + o.total;
    const area = document.getElementById('receipt-area');
    area.style.left = "0";
    const canvas = await html2canvas(area);
    const link = document.createElement('a'); 
    link.download = `Luxe-Receipt-${o.id}.png`; 
    link.href = canvas.toDataURL(); 
    link.click();
    area.style.left = "-9999px";
}

// --- NOTIFICATIONS ---
function pushNotif(msg) {
    notifs.unshift({ msg, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) });
    if(notifs.length > 10) notifs.pop(); 
    document.getElementById('notif-dot').style.display = 'block';
    updateNotifUI();
}

function updateNotifUI() {
    document.getElementById('notif-feed').innerHTML = notifs.map(n => `
        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-slideUp">
            <p class="text-sm font-medium text-slate-600">${n.msg}</p>
            <p class="text-[10px] font-black text-slate-400 mt-2 uppercase flex items-center gap-1"><i class="fa-regular fa-clock"></i> ${n.time}</p>
        </div>
    `).join('');
}

function toggleNotif() {
    document.getElementById('notif-sidebar').classList.toggle('open');
    document.getElementById('notif-dot').style.display = 'none';
}

// --- VIP WHEEL LOGIC ---
const rewards = ["Try Again", "15% OFF", "Try Again", "20% OFF", "Try Again", "Free Del.", "Try Again", "10% OFF"];
const colors = ["#f8fafc", "#ea580c", "#f1f5f9", "#ea580c", "#f8fafc", "#ea580c", "#f1f5f9", "#ea580c"];

function drawWheel() {
    const canvas = document.getElementById('wheel-canvas'), ctx = canvas.getContext('2d');
    const centerX = 200, centerY = 200, radius = 190, slice = (Math.PI * 2) / 8;
    ctx.clearRect(0,0,400,400);
    rewards.forEach((r, i) => {
        ctx.beginPath(); ctx.fillStyle = colors[i]; ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, i * slice, (i + 1) * slice); ctx.fill();
        ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(i * slice + slice / 2);
        ctx.textAlign = "right"; ctx.fillStyle = i%2===0 ? "#0f172a" : "white"; ctx.font = "bold 18px Plus Jakarta Sans";
        ctx.fillText(r, radius - 30, 6); ctx.restore();
    });
}

function spinWheel() {
    if(spins >= 3) return alert("Daily VIP spins exhausted! Try again tomorrow.");
    if(discount !== 0) return alert("You already have an active discount applied to your cart.");
    
    const canvas = document.getElementById('wheel-canvas');
    spins++;
    
    let resIdx = (spins === 3) ? [1,3,5,7][Math.floor(Math.random()*4)] : Math.floor(Math.random()*8);
    const deg = (spins * 1800) + (resIdx * 45 * -1); 
    canvas.style.transform = `rotate(${deg}deg)`;
    document.getElementById('spin-res').innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> GENERATING ELITE REWARD...';
    
    setTimeout(() => {
        let win = rewards[resIdx];
        if(win !== "Try Again") { 
            discount = win; 
            document.getElementById('spin-res').innerHTML = `<span class="text-emerald-500"><i class="fa-solid fa-gift mr-1"></i> YOU WON: ${win}</span>`;
            pushNotif(`VIP Wheel: Won <strong class="text-orange-600">${win}</strong> Discount!`);
            setTimeout(() => { closeModal('spin-modal'); document.getElementById('spin-res').innerText="";}, 2000); 
        } else {
            document.getElementById('spin-res').innerHTML = `<span class="text-slate-500">Oh no! ${win}. Spins left: ${3-spins}</span>`;
        }
    }, 5000);
}


// ==========================================
// 6. ADMIN PORTAL (ADVANCED)
// ==========================================
function loginAdmin() {
    if(document.getElementById('staff-key').value === "1234") {
        closeModal('admin-lock');
        document.getElementById('staff-key').value = ""; 
        document.getElementById('admin-os').classList.remove('hidden');
        document.body.style.overflow = "auto"; 
        
        // Hide Main Site
        document.getElementById('main-site-content').style.display = 'none';
        document.querySelector('nav').style.display = 'none';
        document.querySelector('footer').style.display = 'none';
        document.querySelector('.notif-trigger').style.display = 'none';
        
        updateAdminOrders();
        renderAdminProducts();
    } else alert("Invalid Admin PIN");
}

function logoutAdmin() { location.reload(); }

function switchAdminTab(tab) {
    document.getElementById('view-orders').classList.add('hidden');
    document.getElementById('view-products').classList.add('hidden');
    document.getElementById('tab-orders').className = "font-black text-xl text-slate-400 hover:text-slate-900 pb-2";
    document.getElementById('tab-products').className = "font-black text-xl text-slate-400 hover:text-slate-900 pb-2";
    
    document.getElementById('view-' + tab).classList.remove('hidden');
    document.getElementById('tab-' + tab).className = "font-black text-xl text-blue-600 border-b-2 border-blue-600 pb-2";
}

// ADMIN: ORDER MANAGEMENT
function updateAdminOrders(data = orders) {
    const log = document.getElementById('order-log');
    if(data.length === 0) {
        log.innerHTML = `<div class="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300"><p class="text-slate-500 font-bold">No orders found.</p></div>`;
        return;
    }
    
    log.innerHTML = data.map(o => {
        let isDone = o.status === 'Completed';
        return `
        <div class="bg-white p-6 rounded-3xl border ${isDone ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'} shadow-sm flex flex-col md:flex-row justify-between gap-4 hover:shadow-md transition-all">
            <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                    <span class="bg-${isDone ? 'emerald' : 'blue'}-100 text-${isDone ? 'emerald' : 'blue'}-600 text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest">${o.status || 'Processing'}</span>
                    <h4 class="font-black text-lg text-slate-900">Order #${o.id}</h4>
                    <span class="text-xs font-bold text-slate-400"><i class="fa-regular fa-clock"></i> ${o.date}</span>
                </div>
                
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3 mt-2">
                    <p class="text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Customer Details</p>
                    <p class="text-sm font-bold text-slate-800">${o.customer} <span class="text-slate-500 font-normal ml-2"><i class="fa-solid fa-phone text-[10px]"></i> ${o.phone}</span></p>
                    <p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-location-dot"></i> ${o.city}, ${o.address}</p>
                </div>
                
                <p class="font-black text-xl text-slate-900">${o.total}</p>
            </div>
            
            <div class="flex flex-col gap-2 justify-center w-full md:w-32 shrink-0">
                <button onclick='alert("Ordered Items:\\n\\n${o.items.map(i=> "- " + i.name + " (Rs." + i.price + ")").join('\\n')}")' class="w-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 px-4 py-3 rounded-xl text-xs font-bold transition-colors shadow-sm">View Items</button>
                
                ${!isDone ? `
                <button onclick="adminSendOrder('${o.dbKey}')" class="w-full bg-blue-100 border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-3 rounded-xl text-xs font-bold transition-colors shadow-sm"><i class="fa-solid fa-paper-plane mr-1"></i> Send</button>
                <button onclick="adminOkOrder('${o.dbKey}')" class="w-full bg-emerald-100 border border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white px-4 py-3 rounded-xl text-xs font-bold transition-colors shadow-sm"><i class="fa-solid fa-check mr-1"></i> OK</button>
                ` : `
                <button disabled class="w-full bg-emerald-50 text-emerald-400 px-4 py-3 rounded-xl text-xs font-bold cursor-not-allowed border border-emerald-100"><i class="fa-solid fa-check-double mr-1"></i> Completed</button>
                `}
            </div>
        </div>
        `;
    }).join('');
}

function adminOkOrder(dbKey) {
    if(!useFirebase || !dbKey) return alert("Firebase connection required for real-time updates.");
    db.ref('orders/' + dbKey).update({ status: 'Processing - Notified' }).then(() => {
        alert("Order acknowledged. Customer will be notified.");
        pushNotif(`System: Delivery notice sent for Order.`);
    });
}

function adminSendOrder(dbKey) {
    if(!useFirebase || !dbKey) return alert("Firebase connection required for real-time updates.");
    if(confirm("Mark this order as Sent/Completed?")) {
        db.ref('orders/' + dbKey).update({ status: 'Completed' }).then(() => {
            alert("Order marked as Completed!");
        });
    }
}

function lookupOrders() {
    const n = document.getElementById('search-adm-n').value.toLowerCase();
    updateAdminOrders(orders.filter(o => o.customer.toLowerCase().includes(n) || o.id.toLowerCase().includes(n)));
}

// ADMIN: PRODUCT MANAGEMENT
function addNewProduct(e) {
    e.preventDefault();
    const name = document.getElementById('new-p-name').value;
    const price = parseInt(document.getElementById('new-p-price').value);
    const cat = document.getElementById('new-p-cat').value;
    const img = document.getElementById('new-p-img').value;
    
    const newProduct = { id: Date.now(), name: name, price: price, cat: cat, img: img };
    
    if(useFirebase) {
        db.ref('products').push(newProduct).then(() => {
            alert(`Success! "${name}" added to Database.`);
            e.target.reset();
        });
    }
}

function renderAdminProducts() {
    const log = document.getElementById('admin-product-log');
    document.getElementById('stat-posts').innerText = allProducts.length;
    
    if(allProducts.length === 0) {
        log.innerHTML = `<div class="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300"><p class="text-slate-500 font-bold">No products found.</p></div>`;
        return;
    }

    log.innerHTML = allProducts.map(p => `
        <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-slate-300 transition-all">
            <div class="flex items-center gap-4">
                <img src="${p.img}" class="w-12 h-12 rounded-lg object-cover">
                <div>
                    <span class="text-[9px] font-black text-orange-600 uppercase tracking-widest">${p.cat}</span>
                    <h4 class="text-slate-900 font-bold text-sm line-clamp-1">${p.name}</h4>
                    <p class="text-xs font-medium text-slate-500">Rs. ${p.price}</p>
                </div>
            </div>
            <button onclick="deleteProduct('${p.id}', '${p.dbKey}')" class="w-10 h-10 bg-red-50 rounded-xl text-red-500 hover:bg-red-500 hover:text-white border border-red-100 shadow-sm transition-all shrink-0"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('');
}

function deleteProduct(id, dbKey) {
    if(confirm("Are you sure you want to permanently delete this product?")) {
        if(useFirebase && dbKey && dbKey !== 'undefined') {
            db.ref('products/' + dbKey).remove().then(() => alert("Product deleted from DB."));
        }
    }
}

// UTILS
function openModal(id) { document.getElementById(id).style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; document.body.style.overflow = 'auto'; }