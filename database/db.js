import mysql from 'mysql2'
import dotenv from 'dotenv'
dotenv.config();

const con = mysql.createConnection({
    host:process.env.HOST,
    user:process.env.USER,
    password:process.env.PASSWORD,
    database:process.env.DATABASE
   
})

con.connect(function(err){
    if(err){
        console.log("Connection Error")
        console.log(err)
    }else{
        console.log("Connected")
    }
    
});

export default con;