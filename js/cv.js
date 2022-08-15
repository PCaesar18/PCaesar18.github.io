function pwdCVprotect(){

  var password = prompt('Enter the password to download Curriculum Vitae file! By uncertainty, please email me at: Pepijndekeijzer@gmail.com');
  if(password.toLowerCase() == "found_on_github!"){
    window.open("images/myCV.pdf")
  }else{
    alert(" ai that is a shame, incorrect password! please try again");
  }
}

function openThesis(){
  window.open("images/Thesis.pdf")
  //
  // var password = prompt('Enter the password to download Curriculum Vitae file! By uncertainty, please email me at: Pepijndekeijzer@gmail.com');
  // if(password.toLowerCase() == "found_on_github!"){
  //   window.open("images/myCV.pdf")
  // }else{
  //   alert(" ai that is a shame, incorrect password! please try again");
  // }
}

