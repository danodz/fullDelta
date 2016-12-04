ip = "localhost";
port = "4567";

document.addEventListener("DOMContentLoaded", init);

function send(msg)
{
    co.send(JSON.stringify(msg));
}

// hack for firefox
// I don't even know if it's usefull
window.onbeforeunload = function()
{
    co.close();
};

function openConnection( onopen , onmessage )
{
    co = new WebSocket("ws://" + ip + ":" + port);
    co.onmessage = e => onmessage(JSON.parse(e.data));
    co.onopen = onopen
    co.onclose = function(e){ console.log("onclose",e.data); };
}

function initUpdate()
{
    if ( window.deadIntervalId )
        clearInterval(window.deadIntervalId);
    if ( window.updateIntervalId )
        clearInterval(window.updateIntervalId);
    updateIntervalId = setInterval(update,1000/30);
}

function initDead()
{
    if ( window.updateIntervalId )
        clearInterval(window.updateIntervalId);
    if ( window.deadIntervalId )
        clearInterval(window.deadIntervalId);
    deadIntervalId = setInterval(dead,1000/30);
}

function init()
{
    keys = {};
    document.onkeydown = e =>
    {
        var evt = e || event.keyCode;
        var press = evt.which || event.keyCode;
        
        keys[ press+"" ] = true;
    };
    document.onkeyup = e =>
    {
        var evt = e || event.keyCode;
        var press = evt.which || event.keyCode;
        //log(press);
        
        keys[ press+"" ] = false;
    };
    
    canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    document.body.onresize = resizeGame;
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    gameWidth = canvas.width;
    gameHeight = canvas.height;

    mousePos = {x:0,y:0};
    getMousePosE = function(canvas, evt)
    {
        var rect = canvas.getBoundingClientRect();
        
        return { x : evt.clientX - rect.left - (innerWidth/2)
               , y : (evt.clientY - rect.top) - (innerHeight/2)
               };
    }
    canvas.addEventListener('mousemove', function(evt)
    {
        mousePos = getMousePosE( canvas , evt );
    }, false);
    
    mouseDown = false;
    mouseClick = false;
    canvas.addEventListener( 'mousedown' , function(){ mouseDown = true; } );
    canvas.addEventListener( 'mouseup' , function(){ mouseDown = false; } );
    canvas.addEventListener( 'click' , function(){ mouseClick = true; } );
    
    ctx = canvas.getContext("2d");
    camX = 0;
    camY = 0;
    
    ships = {};
    projs = [];
    arena = { xMin : -1000 , xMax : 1000 , yMin : -1000 , yMax : 1000};
    
    radar = { x : gameWidth/2 * 0.60
            , y : gameHeight/2 * 0.60
            , width : 200
            , height : 200
            , update : function()
                {
                    this.x = gameWidth/2 - this.width - 30;
                    this.y = gameHeight/2 - this.height - 30;
                } 
            , draw : function(){drawRadar()} 
            };
    
    ui = { speedControl : createHandleBar( 0, -10, 50, 300, 0.5, -100, 100)
         };
    
    openConnection( function(){} , msg =>
    {
        if ( window.logMsgs )
            log(msg);
        
        if ( msg.type == "connected" )
        {
            player.id = msg.id;
        }
        else if ( msg.type == "arena" )
        {
            arena = msg.arena;
        }
        else if ( msg.type == "team" )
        {
            player.team = msg.team;
        }
        else if ( msg.type == "life" )
        {
            player.life = msg.life;
            player.maxLife = msg.maxLife;   
        }
        else if ( msg.type == "sp" )
        {
            var sh = ships[msg.id];
            if ( sh )
            {
                sh.x = msg.x;
                sh.y = msg.y;
                sh.angle = msg.angle;
            }
        }
        else if ( msg.type == "init game" )
        {
            initUpdate();
            ships = {};
            projs = [];
        }
        else if ( msg.type == "add ship" )
        {
            ships[ msg.data.id ] = msg.data;
        }
        else if ( msg.type == "rm player" )
        {
            if ( msg.id == player.id )
                initDead();
        }
        else if ( msg.type == "rm ship" )
        {
            delete ships[msg.id];
        }
        else if ( msg.type == "shoot" )
        {
            projs.push( msg.data );
        }
        else if ( msg.type == "hit" )
        {
            player.velX += trustX( msg.angle , 25 );
            player.velY += trustY( msg.angle , 25 );
            player.angle += Math.random()*90-45;
        }
    });
    
    generateStars(500);
    
    player = { x : 0
             , y : 0
             , width : 60
             , height : 60
             , maxLife : 100
             , life : 100
             , velX : 0
             , velY : 0
             , velA : 0
             , speed : 0
             , maxSpeed : 3
             , minSpeed : -1
             , acceleration : 0.01
             , turnSpeed : 0.75
             , angle : 0
             , update : function()
                 {
                     this.angle += this.velA;
                     
                     var changedSpeed = keys[38] || keys[40];
                     
                     this.speed = ui.speedControl.value * 2 - 1;
                     if ( keys[38] )
                         this.speed += this.acceleration;
                     if ( keys[40] )
                         this.speed -= this.acceleration;
                     if ( this.speed > 1 ) this.speed = 1;
                     if ( this.speed < -1 ) this.speed = -1;

                     ui.speedControl.value = (this.speed + 1) / 2;
                     
                     var realSpeed = this.speed;
                     if ( realSpeed > 0 ) realSpeed *= this.maxSpeed;
                     if ( realSpeed < 0 ) realSpeed *= -this.minSpeed;
                     this.velX += trustX( this.angle , realSpeed );
                     this.velY += trustY( this.angle , realSpeed );
                     
                     this.velX *= 0.8;
                     this.velY *= 0.8;
                     this.velA *= 0.8;
                     
                     this.x += this.velX;
                     this.y += this.velY;
                     this.angle += this.velA;
                     
                     if ( keys[37] )
                         this.velA -= this.turnSpeed;
                     if ( keys[39] )
                         this.velA += this.turnSpeed;
                     
                     correctPosition(this);
                     
                     send({ type : "p" , x : this.x , y : this.y , speed : this.speed , changedSpeed : changedSpeed , angle : this.angle });
                     
                     if ( keys[32] )
                     {
                         send({ type : "shoot"
                              });
                     }
                 }
             };
}

function generateStars(nbStars)
{
    stars = [];
    for ( var i = 0 ; i < nbStars ; i++ )
        stars.push( { x : Math.random()*gameWidth - gameWidth/2 , y : Math.random()*gameHeight - gameHeight/2 } );
}

function resizeGame()
{
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    gameWidth = canvas.width;
    gameHeight = canvas.height;
    generateStars(500);
}

function dead()
{
    ctx.save();
    
    if ( keys[82] )
        send({ type : "respawn" });
    
    ctx.fillStyle = "red";
    ctx.fillRect(0,0,10000,10000);
    
    ctx.restore();
}

function update()
{
    ctx.save();
    
    ctx.fillStyle = "black";
    ctx.fillRect(0,0,10000,10000);
    
    ctx.translate(window.innerWidth/2 , window.innerHeight/2);
    
    ctx.translate(-camX,-camY);
    
    ctx.fillStyle = "white";
    for ( var i in stars )
        ctx.fillRect( stars[i].x , stars[i].y , 2 , 2 );
        
    for ( var id in ships )
    {
        var sh = ships[id];
        
        if ( id == player.id )
        {
            sh.x = player.x;
            sh.y = player.y;
            sh.angle = player.angle;
            player.type = sh.type; // :(
        }
        
        if ( sh.team == 1 )
        {
            if ( sh.type == 1 )
                drawImg( sh.x , sh.y , sh.angle , "imgs/v5.png" );
            else
                drawImg( sh.x , sh.y , sh.angle , "imgs/v51.png" );
        }
        else
        {
            if ( sh.type == 1 )
                drawImg( sh.x , sh.y , sh.angle , "imgs/v6.png" );
            else
                drawImg( sh.x , sh.y , sh.angle , "imgs/v61.png" );
        }
    }
    
        
    radar.update();
    radar.draw();

    for (var i in ui)
    {
        ui[i].update();
        ui[i].draw();
    }
    
    drawEmptyRect( arena.xMin , arena.yMin , arena.xMax*2 , arena.yMax*2 , "magenta" , 2);
    
//    if ( player.team == 1 )
//        drawImg( player.x , player.y , player.angle , "imgs/v5.png" );
//    else
//        drawImg( player.x , player.y , player.angle , "imgs/v6.png" );
    
    drawPlayerLifeBar();    
    
    player.update();
    camX = player.x;
    camY = player.y;
    updateStars();
    
    projsUpdate();
    
    ctx.restore();
}

function updateStars()
{
    for (var i = 0; i < stars.length; i++)
    {
        if (stars[i].x < camX - gameWidth/2)
            stars[i].x += gameWidth;
        if (stars[i].x > camX + gameWidth/2)
            stars[i].x -= gameWidth;
        
        if (stars[i].y < camY - gameHeight/2)
            stars[i].y += gameHeight;
        if (stars[i].y > camY + gameHeight/2)
            stars[i].y -= gameHeight;
    }        
}

function drawImg( x , y , angle , url )
{
    ctx.save();
    
    var i = getImg(url);
    if ( i.complete )
    {
        ctx.translate( x , y );
        ctx.rotate( angle * (Math.PI/180) );
        ctx.translate( -i.width/2 , -i.height/2 );
        ctx.drawImage( i , 0 , 0 );
    }
    
    ctx.restore();
}

function drawEmptyRect( x , y , w , h , c , lW)
{
    ctx.save();
    ctx.strokeStyle = c;
    ctx.lineWidth = lW;
    ctx.strokeRect( x , y , w , h );
    ctx.restore();
}

function createWall( x , y , width , height )
{
    return { x : x
           , y : y
           , width : width
           , height : height
           };
}

function correctPosition( e )
{
    if (e.x > arena.xMax)
        e.x = arena.xMax;
        
    if (e.x < arena.xMin)
        e.x = arena.xMin;
        
    if (e.y > arena.yMax)
        e.y = arena.yMax;
        
    if (e.y < arena.yMin)
        e.y = arena.yMin;    
}

imgs = {};
function getImg(url)
{
    if ( imgs[url] )
        return imgs[url];
    else
    {
        var i = document.createElement("img");
        i.src = url;
        imgs[url] = i;
        return i;
    }
}

function projsUpdate()
{
    for ( var i = 0 ; i < projs.length ; i++ )
    {
        proj = projs[i];
        
        proj.x += proj.velX;
        proj.y += proj.velY;

        proj.life -= 1;
        
        drawImg( proj.x , proj.y , proj.angle , "imgs/blaster1.png" );
        
        for ( var id in ships )
        {
            var ship = ships[id];
            if ( proj.team != ship.team && dist2( proj.x , proj.y , ship.x , ship.y ) < 90*90 )
                proj.life = -1;
        }
        
        if ( proj.life < 1 )
        {
            projs.splice(i,1);
            i --;
        }
    }
}

function drawPlayerLifeBar()
{
    drawStaticLine( -gameWidth/2.2 , -gameHeight/2.2 , -gameWidth/2.2 + 200 , -gameHeight/2.2, 10 , "red");
    drawStaticLine( -gameWidth/2.2 , -gameHeight/2.2 , -gameWidth/2.2 + 200*(player.life/player.maxLife) , -gameHeight/2.2, 10 , "cyan");
    var nbBar = player.maxLife/25;
    for (var i = 0; i <= Math.floor(nbBar);i++)
    {
        drawStaticLine( -gameWidth/2.2 + i * (200/nbBar) , -gameHeight/2.2+5 , -gameWidth/2.2 + i * (200/nbBar) , -gameHeight/2.2-5, 1 , "grey");
    }
}

function drawStaticLine( x , y , x2 , y2 , w , c )
{
    ctx.save();
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.moveTo(x+camX , y+camY);
    ctx.lineTo(x2+camX , y2+camY);
    
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
}

function drawStaticEmptyRect( x , y , w , h , c , lW)
{
    ctx.save();
    ctx.strokeStyle = c;
    ctx.lineWidth = lW;
    ctx.strokeRect( x + camX - w/2 , y + camY - h/2, w , h );
    ctx.restore();
}

function drawStaticRect( x , y , w , h , c , a)
{
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = c;
    ctx.fillRect( x + camX - w/2, y + camY - h/2, w , h );
    ctx.restore();
}

function drawRadar()
{
    drawStaticEmptyRect( radar.x , radar.y , radar.width , radar.height , "green" , 2   );
    drawStaticRect     ( radar.x , radar.y , radar.width , radar.height , "green" , 0.25);
    
    for (var i in ships)
    {
        var sh = ships[i];
        
        if ( sh.id == player.id )
            drawStaticRect( radar.x + convertXToRadar(player.x) - 2
                          , radar.y + convertYToRadar(player.y) - 2
                          , 4
                          , 4
                          , "yellow"
                          , 1
                          );
        else
            drawStaticRect( radar.x + convertXToRadar(sh.x)
                          , radar.y + convertYToRadar(sh.y)
                          , sh.type == 1 ? 2 : 5
                          , sh.type == 1 ? 2 : 5
                          , sh.team == 1 ? "cyan" : "red"
                          , 1
                          );
    }
}

function convertXToRadar(x)
{
    return (x - arena.xMin) * (radar.width/(arena.xMax - arena.xMin));
}

function convertYToRadar(y)
{
    return (y - arena.yMin) * (radar.height/(arena.yMax - arena.yMin));
}

function drawTextUI(text)
{
    drawStaticText(text , -gameWidth/5 , -gameHeight/4 , 20 , "white");
}

function drawStaticText(text , x , y , size , c)
{
    ctx.save();
	ctx.font = "" + size + "px Georgia";
	ctx.fillStyle = c;
	ctx.fillText(text , x + camX , y + camY);
	ctx.restore();
}

function log()
{
    console.log.apply(console,arguments);
}

function createHandleBar(x, y, width, height, defaultValue)
{
    var bar = { x : x
              , y : y
              , handleY : defaultValue
              , width : width
              , height : height
              , dragging : false
              , value : defaultValue
              , update : function()
                  {
                      if(mouseDown && collideMouse( this ))
                      {
                          this.dragging = true;
                      }
                      if(!mouseDown)
                      {
                          this.dragging = false;
                      }
                      if(this.dragging)
                      {
                          this.handleY = mousePos.y;
                          if(this.handleY < this.y + 5 - this.height / 2)
                          {
                              this.handleY = this.y + 5 - this.height / 2;
                          }
                          if(this.handleY > this.y - 5 + this.height / 2)
                          {
                              this.handleY = this.y - 5 + this.height / 2;
                          }

                          this.value = ((this.y - this.handleY) / ((this.height - 10)/2) + 1) / 2;
                      }
                  }
              , draw : function()
                  {
                      this.handleY = -(this.value * 2 - 1) * ((this.height - 10)/2) + this.y;
                      drawStaticRect(this.x, this.handleY, this.width, 10, "lightgray");
                      drawStaticEmptyRect(this.x, this.y, this.width, this.height, "white", 3);
                  }
              }
    return bar;
}
