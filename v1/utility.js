

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

function initialse(){
    let start = 1,end = 1000;
    for(let i=0;i<rooms.length;i++){
        rooms_available.push({
            "room_no" : rooms[i].room_no,
            "start" : start,
            "end" : end
        });
    }
    console.log("rooms are initialised");   
}