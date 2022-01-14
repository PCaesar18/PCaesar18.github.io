function passwd(){

  var password = prompt('Enter the password to download the file:');
  if(password.toLowerCase() == "teacher"){
    window.open("images/myCV.pdf")
  }else{
    alert("incorrect password!! please try again");
  }
}
