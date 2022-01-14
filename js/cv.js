function passwd(){

  var password = prompt('Enter the password to download Curriculum Vitae file! By uncertainty, please email me at: Pepijndekeijzer@gmail.com');
  if(password.toLowerCase() == "found_on_github!"){
    window.open("images/myCV.pdf")
  }else{
    alert("incorrect password!! please try again");
  }
}
