const port = 4001;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { log } = require("console");
const { request } = require("http");
const { mongoose_url } = require("./config/config");

app.use(express.json());
app.use(cors());

// Database connection with MongoDB
mongoose.connect(mongoose_url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// API creation
app.get("/", (req, res) => {
  res.send("Express App is running");
});

// Storage image configuration
const storage = multer.diskStorage({
  destination: './upload/images',
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });

// Creating upload endpoint for image
app.use('/images', express.static(path.join(__dirname, '/upload/images')));
app.post("/upload", upload.single('product'), (req, res) => {
  res.json({
    success: 1,
    image_url: `http://localhost:${port}/images/${req.file.filename}`
  });
});

const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
})

app.post('/addproduct', async (req, res) => {
let products=await Product.find({});
let id;
if (products.length>0) {
  
  let last_product_array = products.slice(-1);
  let last_product = last_product_array[0];
  id=last_product.id+1;
}
else{
  id=1;
}
  const product = new Product({
    id:id,
    name:req.body.name,
    image:req.body.image,
    category:req.body.category,
    new_price:req.body.new_price,
    old_price:req.body.old_price,
  });

 console.log(product),
 await product.save();
 console.log("Saved");
 res.json({
  success:true,
  name:req.body.name,
 })
})
//creating API for removing product from the database
app.post('/removeproduct', async (req, res) => {
  await Product.findOneAndDelete({id:req.body.id});
  console.log("Removed");
  res.json({
    success:true,
    name:req.body.name
  })
})
//creating APi for getting all products
app.get('/allproducts', async(req,res)=>{
  let products = await Product.find({});
  console.log("All Product Fetched");
  res.send(products);
})
//schema for creating users Api
const Users = mongoose.model('Users',{
  name:{
    type:String,
  },
  email:{
    type:String,
    unique:true,
  },
  password:{
    type:String,
  },
  cartData:{
    type:Object,
  },
  date:{
    type:Date,
    default:Date.now,
  },
})

app.post('/signup', async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success: false, error: "Existing Email found" });
  }

  let cart = {};
  for (let i = 0; i < 301; i++) {
    cart[i] = 0;
  }

  const user = new Users({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();

  const data = {
    user: {
      id: user.id,
    }
  };

  const token = jwt.sign(data, 'secret_ecom');
  res.json({ success: true, token });
});


app.post('/login',async (req,res)=>{
  let user = await Users.findOne({email:req.body.email});
   
  if (user) {
    const passCompare =req.body.password === user.password;
    if (passCompare) {
     const data ={
        user:{
          id:user.id
        }
      } 
      const token = jwt.sign(data,'secret_ecom');
      res.json({success:true,token})
      }
      else{
        res.json({success:false,errors:"Wrong Password"});
        
      }
    }
    else{
      res.json({success:false,errors:"Wrong Email Id"});
      
    }
   
  }
  )
   //creating new collection endpoint
app.get('/newcollections', async(req,res)=>{
    let product = await Product.find({category:"NewCollections"});
    let newcollection = product.slice(1).slice(-8);
    console.log("NewCollection Fetched");
    res.send(newcollection);
   });
    //creating endpoint for popular women sections
app.get('/popularinwomens',async(req,res)=>{
      let product = await Product.find({category:"women"});
      let popular_in_women = product.slice(0,4);
      console.log("Popular in Women Fetched");
      res.send(popular_in_women); 
    }
    )
    //creating middleware to fetch user
    // Middleware to fetch user
  
const fetchUser = async (req, res, next) => {
const token = req.header('auth-token');
  if (!token) {
    return res.status(401).send({ errors: "Please authenticate using a valid token" });
  }
  try {
    const data = jwt.verify(token, 'secret_ecom');
    req.user = data.user;
    next();
  } 
  catch (error) {
    res.status(401).send({ errors: "Please authenticate using a valid token" });
  }
};

//Endpoint for adding products to cart
app.post('/addtocart', fetchUser, async(req,res) => {
  console.log("Adding item to cart", req.body.itemsId);

  let user = await Users.findOne({_id: req.user.id});
  let itemId = req.body.itemsId;
  console.log("Current cart data before update:", user.cartData);
  if(typeof user.cartData[itemId] === 'undefined') {
    user.cartData[itemId] = 0; // Initialize if not exists
  }
 user.cartData[itemId] = (user.cartData[itemId] || 0) + 1;

 await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: user.cartData });

  console.log("Updated cart data after update:", user.cartData);
  res.send("Added");
});

//Endpoint for removing products from cart
app.post('/removefromcart', fetchUser, async (req, res) => {
  console.log("Removing item from cart", req.body.itemsId);
  let user = await Users.findOne({ _id: req.user.id });
  let itemId = req.body.itemsId;

  if (user.cartData[itemId] > 0) {
    user.cartData[itemId] -= 1;
  }
  await Users.findOneAndUpdate({ _id: req.user.id },{ cartData: user.cartData });

  console.log("Updated cart data:",user.cartData);
  res.send("Removed");
});
app.post('/getcart',fetchUser,async(req,res)=>{
      console.log("GetCart");
  let userData = await Users.findOne({_id:req.user.id});
  res.json(userData.cartData);
  })  
app.listen(port,(error) => {
  if (!error) {
    console.log("Server Running On Port " + port);
  } else {
    console.log("Error:" + error);
  }
});
