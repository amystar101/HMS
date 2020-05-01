

function getlist(){
    let msg = document.getElementById("msg");
    let from = document.getElementById("checkerfrom").value;
    let to = document.getElementById("checkerto").value;
    if(from == null || from.length == 0 || from == ""||to == null || to.length == 0 || to == ""){
        alert("Please enter the valid date");
        return;
    }
    else{
        let fromdate = new Date(from);
        let todate = new Date(to);
        let diff = (todate-fromdate)/86400000;
        diff++;
        if(diff <= 0){
            alert("Please enter the valid date");
            return;
        }
        else{
            let xhttp = new XMLHttpRequest();
            let query = "from="+from+"&to="+to;
            // xhttp["from"] = from;
            // xhttp["to"] = to;
            console.log(query);
            console.log(typeof query);
            console.log(xhttp);
            msg.innerText = "";
            xhttp.onreadystatechange = function(){
                if(this.readyState == 4 && this.status == 200){
                    msg.innerText = "Available Rooms for this Period as of now is " + this.responseText;
                }
            };
            xhttp.open("POST","/query/available",true);
            xhttp.setRequestHeader("Content-type" , "application/x-www-form-urlencoded");
            xhttp.send(query);

        }
    }
}