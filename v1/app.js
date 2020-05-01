const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const asyncloop = require('node-async-loop');
const utility = require('./utility');
const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
let connection = mysql.createConnection({
    host : 'localhost',
    user : 'DB_usename',
    password : 'DB_password',
    database : 'HMS'
});

connection.connect(function(){
    console.log("connected to database");
});

let refference_date = new Date("2020-01-01");
let lock = [],bookingBusy = false,rollbackstatements = [];

app.get('/',function(req,res){
    res.render("home.ejs");
});

app.get("/emp",function(req,res){
    res.render("emp.ejs");
});

app.get("/booking",function(req,res){
    res.render("booking.ejs");
});

app.get("/query/emp",function(req,res){
    res.send("you are here");
});

app.get("/query",function(req,res){
    res.render("query.ejs");
});

app.post("/query/book",function(req,res){
    
    bookingBusy = true;
    let msg = "";
    let fromstring = req.body.from;
    let tostring = req.body.to;
    let no_of_rooms = req.body.no;
    let l = new Date(fromstring),r = new Date(tostring),idno = req.body.idno,idtype = req.body.idtype,fname = req.body.fname;
    let lname=req.body.lname;
    l = (l-refference_date)/86400000;
    r = (r-refference_date)/86400000;
    getavailablerooms(l,r,function(avrooms){
        if(Number(no_of_rooms) > avrooms.length){
            msg = "This number of rooms are not available";
            bookingBusy = false;
            res.render("commonresults.ejs",{
                msg : msg
            });
        }
        else{
            book(l,r,avrooms,Number(no_of_rooms),idno,idtype,function(msg){
                connection.query('select * from customers where id_type="'+idtype+'" && id_no='+idno+';',function(err,results){
                    if(!err){
                        if(results.length == 0){
                            connection.query('insert into customers values("'+idtype+'",'+idno+',"'+fname+'","'+lname+'");',function(err1){
                                if(!err){
                                    bookingBusy = false;
                                    res.render("commonresults.ejs",{
                                        msg : msg
                                    });
                                }
                            });
                        }
                        else{
                            bookingBusy = false;
                            res.render("commonresults.ejs",{
                                msg : msg
                            });   
                        }
                    }
                });

            });

        }
    });

});

app.post('/query/cancel',function(req,res){
    let l = new Date(req.body.from)-refference_date,r = new Date(req.body.to)-refference_date;
    let idtype = req.body.idtype, idno = req.body.idno,cnt = 0;
    l/=86400000;
    r/=86400000;
    connection.query('select * from bookings where id_type="'+(idtype)+'" && id_no='+(idno)+';',function(err,results){
        if(!err){
            if(results.length > 0){
                connection.query('delete from bookings where id_type="'+(idtype)+'" && id_no='+(idno)+';',function(err1){
                    if(!err1){
                        asyncloop(results,function(result,next){
                            joinsegments(result.start,result.end,result.room_no,true,function(start,end){
                                connection.query('insert into rooms_available values('+result.room_no+','+start+','+end+');',function(err2){
                                    if(err2)
                                        console.log("we got an error here");
                                    if(!err2 && cnt+1 == results.length){
                                        let msg = 'rooms booking cancelled';
                                        res.render("commonresults.ejs",{
                                            msg : msg
                                        });
                                    }
                                    cnt++;
                                    next();
                                });
                            });
                        });
                    }
                });
            }
            else{    
                let msg = "no bookings found";
                res.render("commonresults.ejs",{
                    msg : msg
                });
            }
        }
    });


});

app.post("/query/available",function(req,res){
    let l = new Date(req.body.from)-refference_date,r = new Date(req.body.to)-refference_date;
    l/=86400000;
    r/=86400000;
    getavailablerooms(l,r,function(avrooms){
        res.send("'"+avrooms.length+"'");
    });
});

app.get('/query/customerslist',function(req,res){
    connection.query('select * from customers',function(err,results){
        if(!err){
            res.render("customersresult.ejs",{
                results : results
            });
        }
    });
});

app.get('/query/currentbookings',function(req,res){
    connection.query('select * from bookings',function(err,results){
        if(!err){
            for(let i=0;i<results.length;i++){
                let s = results[i].start;
                let temp =Number(refference_date)+Number(s)*86400000;
                temp = new Date(temp);
                results[i].start = temp;
                temp = Number(refference_date)+Number(results[i].end)*86400000;
                temp = new Date(temp);
                results[i].end = temp;
                temp = new Date(Number(results[i].booking_date));
                results[i].booking_date = temp;
            }
            res.render("bookingsresult.ejs",{
                results : results
            });
            // res.send(results);
        }
    });
});

app.get('/query/bookingcustomer',function(req,res){
    res.render("bookingcustomerform.ejs");
});

app.post('/query/getresultbookingcustomer',function(req,res){
    let fname = req.body.fname;
    let lname = req.body.lname;
    connection.query('select * from customers where fname="'+fname+'" && lname="'+lname+'";',function(err,results){
        if(!err){
            if(results.length == 0){
                msg = "No Customer with this name";
                res.render("commonresults.ejs",{
                    msg : msg
                });
            }
            else{
                let done = false;
                bookingsresult(results,function(ans){
                    if(ans.length == 0){
                        done = true;
                        res.render("bookingsresult.ejs",{
                            results : ans
                        }); 
                    }
                    else{
                        for(let i=0;i<ans.length;i++){
                            let s = ans[i].start;
                            let temp =Number(refference_date)+Number(s)*86400000;
                            temp = new Date(temp);
                            ans[i].start = temp;
                            temp = Number(refference_date)+Number(ans[i].end)*86400000;
                            temp = new Date(temp);
                            ans[i].end = temp;
                            temp = new Date(Number(ans[i].booking_date));
                            ans[i].booking_date = temp;
                            if(i +1== ans.length)
                                done = true;
                            // console.log(ans);
                        }
                        res.render("bookingsresult.ejs",{
                            results : ans
                        }); 
                    }
                    // if(done == true){
                    //     res.render("bookingsresult.ejs",{
                    //         results : ans
                    //     }); 
                    // }
                });
                
            }
        }
    });
});

app.get('/query/addroom',function(req,res){
    connection.query('select * from rooms',function(err,results){
        if(!err){
            connection.query('insert into rooms values('+(results.length+1)+',2000);',function(err1){
                if(!err1){
                    connection.query('insert into rooms_available values('+(results.length+1)+',1,1000);',function(err2){
                        if(!err2){
                            let msg = "Room Added at default price 2000";
                        res.render("commonresults.ejs",{
                            msg : msg
                        });
                        }
                    })
                }
            });
        }
    });
});

app.get('/query/listrooms',function(req,res){
    connection.query('select * from rooms',function(err,results){
        if(!err){
            res.render("rooms.ejs",{
                results : results
            });
        }
    });
});

app.get('/query/bookingrecords',function(req,res){
    let results = [];
    res.render("bookingrecords.ejs",{
        results : results
    });
});

app.get('/query/getbookingrecords',function(req,res){
    connection.query('select * from bookingrecords',function(err,results){
        if(!err){
            for(let i=0;i<results.length;i++){
                let s = results[i].start;
                let temp =Number(refference_date)+Number(s)*86400000;
                temp = new Date(temp);
                results[i].start = temp;
                temp = Number(refference_date)+Number(results[i].end)*86400000;
                temp = new Date(temp);
                results[i].end = temp;
                temp = new Date(Number(results[i].booking_date));
                results[i].booking_date = temp;
            }
            res.render("bookingrecords.ejs",{
                results : results
            });
            // res.send(results);
        }
    });
});

app.get('/query/updatebookingrecords',function(req,res){
    
    let currentdate =Date.now();
    let end = Math.floor((currentdate-refference_date)/86400000);
    // console.log(Math.floor((currentdate-refference_date)/86400000));
    connection.query('select * from bookings where end<'+(end)+';',function(err,results){
        if(!err){
            let cnt = 0;
            if(results.length > 0){
                asyncloop(results,function(result,next){
                    connection.query('delete from bookings where room_no="'+(result.room_no)+'" && start='+(result.start)+' && end='+result.end+';',function(err1){
                        if(!err1){
                            joinsegments(result.start,result.end,result.room_no,true,function(start,end){
                                connection.query('insert into rooms_available values('+result.room_no+','+start+','+end+');',function(err2){
                                    if(!err2){
                                        connection.query('insert into bookingrecords values('+result.room_no+','+result.start+','+result.end+',"'+result.id_type+'",'+result.id_no+',"'+result.booking_date+'");',function(err3){
                                            if(!err2){
                                                next();
                                                if(cnt+1 == results.length){
                                                    let msg = "Record Updated";
                                                    res.render("commonresults.ejs",{
                                                        msg : msg
                                                    });
                                                }
                                                cnt++;
                                            }
                                        });
                                    }
                                });
                            });
                        }
                    });
                });
            }
            else{
                let msg = "Records Updated";
                res.render("commonresults.ejs",{
                    msg : msg
                });
            }
        }
    });
    
});

app.listen(PORT,function(){
    // initialse();
    console.log("server has started at " + PORT);
});

// functions 


function booking_update(room_no,start,end,idtype,idno,fun){
    let bdate = Date.now();
    connection.query('insert into bookings values('+room_no+','+start+','+end+',"'+idtype+'",'+idno+',"'+bdate+'");',function(err){
        if(!err){
            if(fun != null)
                return fun();
        }
    });
}

function book(l,r,avrooms,no_of_rooms,idno,idtype,fun){
    let msg = "Room numbers booked are = ";
    for(let i=0;i<no_of_rooms;i++){
        connection.query('delete from rooms_available where room_no='+avrooms[i].room_no+' && start = '+avrooms[i].start+' && end = '+avrooms[i].end+';',function(err,results){
            
            if(err){
                // rollback(function(){
                    msg = "error in booking";
                    if(fun != null){
                        return fun(msg);
                    }
                // });
            }
            else{
                rollbackstatements.push('insert into rooms_available valuse('+avrooms[i].room_no+','+avrooms[i].start+','+avrooms[i].end+');');
                breaksegments(l,r,avrooms[i],function(check){
                    if(check){
                        msg = "error in breaking segments";
                        if(fun != null){
                            return fun(msg);
                        }
                    }
                    else{
                        msg += avrooms[i].room_no+", ";
                        booking_update(avrooms[i].room_no,l,r,idtype,idno,function(){
                            if(i+1 == Number(no_of_rooms)){
                                if(fun != null){
                                    return fun(msg);
                                }
                            }
                        });
                    }
                });
            }
        });
    }
}


function getavailablerooms(l,r,fn){
    let avrooms = [];
    connection.query('select * from rooms_available where start<='+l+' && end>='+r+';',function(err,results){
        if(err)
            throw err;
        else{
            results.forEach(function(room){
                if(Number(room.start)<=l && Number(room.end)>=r){
                    avrooms.push(room);
                }
            });
            if(fn != null)
                return fn(avrooms);
            else
                return avrooms;
        }
    });
}

function breaksegments(l,r,avrooms,fun){
    let goterr = false;
    if(avrooms.start < Number(l)){
        // console.log('insert into rooms_available values('+avrooms.room_no+','+avrooms.start+','+(l-1)+');');
        connection.query('insert into rooms_available values('+avrooms.room_no+','+avrooms.start+','+(l-1)+');',function(err1){
            if(err1){
                goterr = true;
                if(fun != null){
                    return fun(goterr);
                }
            }
            else{
                if(avrooms.end > Number(r)){
                    connection.query('insert into rooms_available values('+avrooms.room_no+','+(r+1)+','+avrooms.end+');',function(err2){
                        // console.log('insert into rooms_available values('+avrooms.room_no+','+(r+1)+','+avrooms.end+');');
                        if(err2){
                            goterr = true;
                            if(fun != null){
                                return fun(goterr);
                            }
                        }
                        else{
                            rollbackstatements.push('delete from rooms_available where room_no='+avrooms.room_no+' && start='+(r+1)+' && end='+avrooms.end+';');
                            if(fun != null){
                                return fun(goterr);
                            }
                        }
                    });
                }
                else{
                    if(fun != null){
                        return fun(goterr);
                    }
                }
                rollbackstatements.push('delete from rooms_available where room_no='+avrooms.room_no+' && start='+avrooms.start+' && end='+(l-1)+';');
            }
        });
    }
    else{
        if(avrooms.end > Number(r)){
            connection.query('insert into rooms_available values('+avrooms.room_no+','+(r+1)+','+avrooms.end+');',function(err1){
                // console.log('2 insert into rooms_available values('+avrooms.room_no+','+(r+1)+','+avrooms.end+');');
                if(err1){
                    goterr = true;
                    if(fun != null){
                        return fun(goterr);
                    }
                }
                else{
                    rollbackstatements.push('delete from rooms_available where room_no='+avrooms.room_no+' && start='+(r+1)+' && end='+avrooms.end+';');
                    if(fun != null){
                        return fun(goterr);
                    }
                }
            });
        }
        else{
            if(fun != null){
                return fun(goterr);
            }
        }

    }
}

function joinsegments(l,r,room_no,check,fun){
    let start = l,end = r;
    if(check == true){
        connection.query('select * from rooms_available where end='+(l-1)+' && room_no='+(room_no)+';',function(err,results){
            if(!err && results.length != 0){
                // console.log(results);
                start = results[0].start;
                connection.query('delete from rooms_available where room_no='+(room_no)+' && end='+(l-1)+';',function(err1){
                    if(!err1){
                        connection.query('select * from rooms_available where start='+(r+1)+' && room_no='+(room_no)+';',function(err2,results1){
                            if(!err2 && results1.length != 0){
                                end = results1[0].end;
                                // console.log(results1);
                                connection.query('delete from rooms_available where room_no='+(room_no)+' && start='+(r+1)+';',function(err3){
                                    if(!err3){
                                        if(fun != null){
                                            // console.log(1);
                                            return fun(start,end);
                                        }
                                    }
                                });   
                            }
                            else if(results1.length == 0)
                                if(fun != null){
                                    // console.log(2);
                                    return fun(start,end);
                                }
                        });
                    }
                });
            }
            else if(!err && results.length == 0){
                // console.log(3);
                return joinsegments(start,end,room_no,false,fun);
            }
        });
    }
    else{
        connection.query('select * from rooms_available where start='+(r+1)+' && room_no='+(room_no)+';',function(err,results){
            if(!err && results.length != 0){
                connection.query('delete from rooms_available where room_no='+(room_no)+' && start='+(r+1)+';',function(err1){
                    if(!err1){
                        end = results[0].end;
                        if(fun != null){
                            // console.log(4);
                            return fun(start,end);
                        }
                    }
                });   
            }
            else if(!err && results.length == 0)
                if(fun != null){
                    // console.log(5);
                    return fun(start,end);
                }
        });
    }

}

function rollback(fun){
    while(rollback.length > 0){
        connection.query(rollbackstatements[rollbackstatements.length-1],function(err){
            if(!err){
                rollbackstatements.pop();
                if(rollbackstatements.length == 0){
                    if(fun != null)
                        return fun();
                }
            }
        });
    }
}

function bookingsresult(results,fun){
    let ans = [],cnt  = 0;
    results.push(1);
    asyncloop(results,function(result,next){
        if(result == 1){
            fun(ans);
        }
        else{
            connection.query('select * from bookings where id_type="'+result.id_type+'" && id_no='+result.id_no+';',function(err1,results1){
                if(!err1){
                    for(let i=0;i<results1.length;i++){
                        ans.push(results1[i]);
                    }
                    next();
                    cnt++;
                }
            });
        }
    });
}