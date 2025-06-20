import express, { response } from "express";
import con from "../database/db.js";
import jwt from "jsonwebtoken";
// import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";

const router = express.Router();

router.post("/admin_login", (req, res) => {
  console.log(req.body);
  const sql = "SELECT * from admin Where email = ? and password = ?";
  con.query(sql, [req.body.email, req.body.password], (err, result) => {
    if (err) return res.json({ loginStatus: false, Error: "Query error" });
    if (result.length > 0) {
      const email = result[0].email;
      const token = jwt.sign(
        { role: "admin", email: email, id: result[0].id },
        "jwt_secret_key",
        { expiresIn: "5d" }
      );
      res.cookie("token", token);
      console.log(token);
      return res.json({ loginStatus: true });
    } else {
      return res.json({ loginStatus: false, Error: "wrong email or password" });
    }
  });
});

router.get("/user_list", (req, res) => {
  const sql = "SELECT * FROM users";
  con.query(sql, (err, Result) => {
    if (err) return res.json({ Status: false, Error: "Query error" });
    return res.json({ Status: true, Result: Result });
  });
});

router.delete("/delete_user/:id", (req, res) => {
  const id = req.params.id;
  const sql = "delete from users where id = ?";
  con.query(sql, [id], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });
    return res.json({ Status: true, Result: result });
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/images"),
  filename: (req, file, cb) =>
    cb(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    ),
});
const upload = multer({ storage: storage });




router.post("/add_property", upload.single("image"), (req, res) => {
  const {
    email, pro_name, owner_name, price, description,
    address_loc, city, zip_code, area, country, state,
    property_type, property_status, property_size,
    no_bedrooms, no_bathrooms, no_garage
  } = req.body;

  const image = req.file ? req.file.filename : null;

  const insertProperty = `
    INSERT INTO property (email, pro_name, owner_name, price, image, description)
    VALUES (?, ?, ?, ?, ?, ?)`;

  con.query(insertProperty, [email, pro_name, owner_name, price, image, description], (err, result) => {
    if (err) return res.status(500).json({ error: "Property Insert Failed", err });

    const propertyId = result.insertId;

    const insertAddress = `
      INSERT INTO address (property_id, address_loc, city, zip_code, area, country, state)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;

    con.query(insertAddress, [propertyId, address_loc, city, parseInt(zip_code), area, country, state], (err) => {
      if (err) return res.status(500).json({ error: "Address Insert Failed", err });

      const insertDetails = `
        INSERT INTO details (property_id, property_type, property_status, property_size, no_bedrooms, no_bathrooms, no_garage)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

      con.query(insertDetails, [
        propertyId,
        property_type,
        property_status,
        property_size,
        parseInt(no_bedrooms),
        parseInt(no_bathrooms),
        parseInt(no_garage)
      ], (err) => {
        if (err) return res.status(500).json({ error: "Details Insert Failed", err });

        // Handle features safely
        const toBoolean = (val) => val === 'true' || val === true || val === 1 || val === '1';
        const getFeatureValue = (field) => toBoolean(req.body[field] || false) ? 1 : 0;

        const insertFeatures = `
          INSERT INTO features (
            property_id, air_conditioning, shared_gym, external_yard, dryer, gym, laundry,
            kitchen_appliances, outdoor_shower, two_refrigerators, club_house, tv_cable, washer
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        con.query(insertFeatures, [
          propertyId,
          getFeatureValue('air_conditioning'),
          getFeatureValue('shared_gym'),
          getFeatureValue('external_yard'),
          getFeatureValue('dryer'),
          getFeatureValue('gym'),
          getFeatureValue('laundry'),
          getFeatureValue('kitchen_appliances'),
          getFeatureValue('outdoor_shower'),
          getFeatureValue('two_refrigerators'),
          getFeatureValue('club_house'),
          getFeatureValue('tv_cable'),
          getFeatureValue('washer')
        ], (err) => {
          if (err) return res.status(500).json({ error: "Features Insert Failed", err });

          return res.status(200).json({ message: "Property added successfully!" });
        });
      });
    });
  });
});

router.get("/property_list", (req, res) => {
  const sql = "SELECT * FROM property";
  con.query(sql, (err, Result) => {
    if (err) return res.json({ Status: false, Error: "Query error" });
    return res.json({ Status: true, Result: Result });
  });
});


router.delete("/delete_property/:id", (req, res) => {
  const id = req.params.id;
  const sql = "delete from property where id = ?";
  con.query(sql, [id], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });
    return res.json({ Status: true, Result: result });
  });
});

router.get('/total_count', (req, res) => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM property) AS total_properties
  `;

  con.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching totals:", err);
      return res.status(500).json({ 
        status: false, 
        error: "Database query error", 
        details: err 
      });
    }

    //! result is an array with one object: [ { total_users: 5, total_properties: 12 } ]
    const data = result[0];

    return res.status(200).json({
      status: true,
      message: "Counts fetched successfully",
      data: {
        users: data.total_users,
        properties: data.total_properties
      }
    });
  });
});


// routes/admin.js or any appropriate file
router.get("/inquiries", (req, res) => {
  const sql = `
    SELECT 
  inquiries.user_id,
  inquiries.property_id,
  inquiries.message,
  inquiries.created_at,  
  inquiries.admin_reply,  
  users.name AS user_name,
  users.image AS user_image,
  property.pro_name AS property_name
FROM inquiries
JOIN users ON inquiries.user_id = users.id
JOIN property ON inquiries.property_id = property.id
ORDER BY inquiries.created_at DESC

  `;

  con.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.json({ success: false, error: "Database error" });
    }
    res.json({ success: true, data: result });
  });
});

// Delete inquiry by ID
router.delete("/inquiries/:user_id/:property_id", (req, res) => {
  const { user_id, property_id } = req.params;
  const sql = `
    DELETE FROM inquiries 
    WHERE user_id = ? AND property_id = ?
  `;
  con.query(sql, [user_id, property_id], (err, result) => {
    if (err) return res.json({ success: false, error: "Delete failed" });
    res.json({ success: true });
  });
});


// POST /admin/inquiries/reply/:id
router.post('/inquiries/reply', (req, res) => {
  let { user_id, property_id, reply } = req.body;

  if (!user_id || !property_id) {
    return res.status(400).json({ success: false, error: "Missing user_id or property_id" });
  }

  // Treat empty string reply as NULL
  if (reply === "") {
    reply = null;
  }

  const sql = `UPDATE inquiries SET admin_reply = ? WHERE user_id = ? AND property_id = ?`;

  con.query(sql, [reply, user_id, property_id], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.json({ success: false, error: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.json({ success: false, error: "Inquiry not found" });
    }

    res.json({ success: true, message: "Reply saved successfully" });
  });
});


router.get("/property_detail/:id", (req, res) => {
  const propertyId = req.params.id;

  const query = `
    SELECT 
      p.id, p.email, p.pro_name, p.owner_name, p.price, p.image, p.description,
      a.address_loc, a.city, a.zip_code, a.area, a.country, a.state,
      d.property_type, d.property_status, d.property_size, d.no_bedrooms, d.no_bathrooms, d.no_garage,
      f.air_conditioning, f.shared_gym, f.external_yard, f.dryer, f.gym, f.laundry, f.kitchen_appliances,
      f.outdoor_shower, f.two_refrigerators, f.club_house, f.tv_cable, f.washer
    FROM property p
    LEFT JOIN address a ON p.id = a.property_id
    LEFT JOIN details d ON p.id = d.property_id
    LEFT JOIN features f ON p.id = f.property_id
    WHERE p.id = ?
  `;

  con.query(query, [propertyId], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query error", err });
    if (result.length === 0) return res.json({ Status: false, Error: "Property not found" });

    res.json({ Status: true, Result: result[0] });
  });
});


router.post("/edit_property/:id", upload.single("image"), (req, res) => {
  const id = req.params.id;
  const image = req.file ? req.file.filename : req.body.existingImage;

  // Update property table
  const propertySql = `
    UPDATE property 
    SET email=?, pro_name=?, owner_name=?, price=?, image=?, description=?
    WHERE id=?
  `;
  const propertyValues = [
    req.body.email,
    req.body.pro_name,
    req.body.owner_name,
    req.body.price,
    image,
    req.body.description,
    id
  ];

  con.query(propertySql, propertyValues, (err, result1) => {
    if (err) return res.json({ Status: false, Error: err });

    // Update address table
    const addressSql = `
      UPDATE address 
      SET address_loc=?, city=?, zip_code=?, area=?, country=?, state=? 
      WHERE property_id=?
    `;
    const addressValues = [
      req.body.address_loc,
      req.body.city,
      req.body.zip_code,
      req.body.area,
      req.body.country,
      req.body.state,
      id
    ];

    con.query(addressSql, addressValues, (err, result2) => {
      if (err) return res.json({ Status: false, Error: err });

      // Update details table
      const detailsSql = `
        UPDATE details 
        SET property_type=?, property_status=?, property_size=?, no_bedrooms=?, no_bathrooms=?, no_garage=?
        WHERE property_id=?
      `;
      const detailsValues = [
        req.body.property_type,
        req.body.property_status,
        req.body.property_size,
        req.body.no_bedrooms,
        req.body.no_bathrooms,
        req.body.no_garage,
        id
      ];

      con.query(detailsSql, detailsValues, (err, result3) => {
        if (err) return res.json({ Status: false, Error: err });

        // Update features table
        const featuresSql = `
          UPDATE features 
          SET air_conditioning=?, shared_gym=?, external_yard=?, dryer=?, gym=?, laundry=?,
              kitchen_appliances=?, outdoor_shower=?, two_refrigerators=?, club_house=?, tv_cable=?, washer=?
          WHERE property_id=?
        `;
        const featuresValues = [
          req.body.air_conditioning === 'true',
          req.body.shared_gym === 'true',
          req.body.external_yard === 'true',
          req.body.dryer === 'true',
          req.body.gym === 'true',
          req.body.laundry === 'true',
          req.body.kitchen_appliances === 'true',
          req.body.outdoor_shower === 'true',
          req.body.two_refrigerators === 'true',
          req.body.club_house === 'true',
          req.body.tv_cable === 'true',
          req.body.washer === 'true',
          id
        ];

        con.query(featuresSql, featuresValues, (err, result4) => {
          if (err) return res.json({ Status: false, Error: err });

          return res.json({ Status: true, Message: "Property updated successfully." });
        });
      });
    });
  });
});

router.get('/logout', (req, res) => {
  res.clearCookie('token'); // or whatever token name you're using
  return res.json({ logout: true, message: 'Admin logged out successfully' });
});



export { router as admin };
