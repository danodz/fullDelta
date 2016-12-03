var wsServer = require('ws').Server;
var utils = require('./utils.js');
var log = require('./utils.js').log;

console.log("Ready yourself for the start of the disputedWaypoint server!!");

var arena = { xMin : -2000
            , xMax :  2000
            , yMin : -2000
            , yMax :  2000
            };

var players = [];
var deadPlayers = [];
function genPlayerId()
{
    var id;
    do
        id = Math.round(Math.random()*100000);
    while (players[id] !== undefined)
    return id;
}

var projs = [];
function addProj(proj)
{
    projs.push(proj);
    msgs.push( { type : "shoot" , data : proj } );
}

var ships = {};
function genShipId()
{
    var id;
    do
        id = Math.round(Math.random()*100000);
    while (ships[id] !== undefined)
    return id;
}
function addShip( x , y , team , type )
{
    var maxLife = 50;
    if ( type == 2 )
        maxLife = 1000;
    
    var ship = ({ x : x
                , y : y
                , velX : 0
                , velY : 0
                , angle : 0
                , turnDirection : 0
                , trustPower : 0
                , type : type
                , id : genShipId()
                , team : team
                , ai : true
                , life : { hurt : function(x)
                            {
                                this.life -= x;
                            }
                         , life : maxLife
                         , maxLife : maxLife
                         , isDead : function(){ return this.life <= 0; }
                         }
                , weaponCoolDown : 0
                , update : function(){ this.weaponCoolDown -= 1; }
                , fire : function()
                    {
                        if ( this.weaponCoolDown <= 0 )
                        {
                            this.weaponCoolDown = 34;
                            var n = ship.type == 1 ? 1 : 11;
                            for ( var i = 0 ; i < n ; i++ )
                            {
                                var an = this.angle + ((90/n)*i) - 45;
                                if ( ship.type == 1 )
                                    an = this.angle;
                                
                                addProj({ x : this.x
                                        , y : this.y
                                        , velX : utils.trustX( an , 20 )
                                        , velY : utils.trustY( an , 20 )
                                        , angle : an
                                        , life : 300
                                        , dmg : 10
                                        , team : this.team
                                        });
                            }
                        }
                    }
                });          
    ships[ship.id] = ship;
    msgs.push({ type : "add ship"
              , data : ship
              });
    
    return ship;
}

var wss = new wsServer( { port: 4567 } );

var teamCount = 0;

function addPlayer(player)
{
    player.send({ type : "init game" });
    player.send({ type : "arena" , arena : arena });
    player.id = player.ship.id;
    players.push(player);
    
    for ( var i in ships )
    {
        var ship = ships[i];
        player.send({ type : "add ship"
                    , data : { x : ship.x
                             , y : ship.y
                             , angle : ship.angle
                             , id : ship.id
                             , team : ship.team
                             , type : ship.type
                             }
                    });
    }
}

function initPlayerShip(player)
{
    var team;
    if ( player.ship )
        team = player.ship.team;
    else
        team = (teamCount++)%2==0?1:2
    
    player.send({ type : "team" , team : team });
    
    player.ship = addShip( 0 , 0 , team , 1 );
    player.ship.ai = false;
    player.ship.weaponCoolDown = 0;
    player.ship.update = function()
    {
        this.weaponCoolDown -= 1;
    };
}

wss.on('connection', ws =>
{
    ws.sendJSON = json => { ws.send( JSON.stringify(json) ); };
    
    var player = { ws : ws
                 , send : function(json)
                     {
                         try { this.ws.sendJSON(json); }
                         catch(e){ console.log("Error in send : " , e, "killing player") ; player.remove() ; }
                     }
                 };
    initPlayerShip(player);
    addPlayer(player);
    player.send( { type : "connected" , id : player.id } );
    
    ws.on('message', message =>
    {
        var msg = utils.maybe(utils.safeJSONParse(message));
        
        msg.map( msg =>
        {
            if ( msg.type == "p" && msg.x != undefined && msg.y != undefined && msg.angle != undefined && msg.speed != undefined && msg.changedSpeed != undefined )
            {
                player.ship.x = msg.x;
                player.ship.y = msg.y;
                player.ship.angle = msg.angle;
                if ( msg.changedSpeed )
                    player.ship.speed = msg.speed;
            }
            else if ( msg.type == "shoot" && !player.ship.life.isDead() )
            {
                player.ship.fire();
            }
            else if ( msg.type == "respawn" )
            {
                for ( var i = 0 ; i < deadPlayers.length ; i++ )
                    if ( deadPlayers[i] == player )
                    {
                        deadPlayers.splice(i,1);
                        break;
                    }
                addPlayer(player);
                initPlayerShip(player);
                player.id = player.ship.id;
                player.send( { type : "connected" , id : player.id } );
            }
            else if ( msg.type == "take ship" )
            {
                var sh = ships[msg.id];
                if ( sh && sh.ai && sh.team == player.ship.team && sh.type == 2 )
                {
                    player.ship.ai = true;
                    player.ship = ships[msg.id];
                    player.ship.ai = false;
                    player.id = player.ship.id
                    player.send({ type : "connected" , id : player.id });
                }
            }
        });
    });
    
    ws.on('close', () =>
    {
        player.remove();
    });
    
    player.remove = function()
    {
        ws.close();
        player.toRemove = true;
        player.ship.life.life = -100;
        
        msgs.push({ type : "rm player"
                  , id : player.id
                  });
    };
});

var msgs = [];
var mainUpdate = setInterval(() =>
{
    actMsgs = msgs;
    msgs = [];
    
    for ( var i = 0 ; i < players.length ; i++ )
    {
        var player = players[i];
        player.ship.update();
        for ( var ii in actMsgs )
            player.send( actMsgs[ii] );
        player.send({ type : "life"
                    , life : player.ship.life.life
                    , maxLife : player.ship.life.maxLife
                    })        
        if ( player.ship.life.isDead() || player.toRemove )
        {
            var ms = { type : "rm player"
                     , id : player.id
                     };
            player.send(ms);
            players.splice(i,1)
            i--;
            if ( !player.toRemove )
                deadPlayers.push(player);
        }
    }
    
    projsUpdate();
    shipsUpdate();
}
,1000/30);

function shipsUpdate()
{
    var ids = Object.keys(ships);
    
    for ( var id in ships )
    {
        var ship = ships[id];
        ship.update();
        
        ship.x += ship.velX;
        ship.y += ship.velY;
        ship.velX *= 0.95;
        ship.velY *= 0.95;
        
        if ( Math.random() < 0.1 ) // chances that we look for a beter target
        {
            var tid = ids[Math.floor(Math.random()*ids.length)];
            
            if ( ships[tid] )
            {
                if ( ships[tid].team != ship.team ) // only target enemy ships
                {
                    var dist = 10000000000000;
                    if ( ship.target && ship.target.life.life > 0 )
                        dist = utils.dist2( ship.x , ship.y , ship.target.x , ship.target.y );
                    
                    var d2 = utils.dist2( ship.x , ship.y , ships[tid].x , ships[tid].y );
                    if ( d2 < dist )
                        ship.target = ships[tid];
                }
            }
            else
                log("ERROR WITH ships[tid] with tid of :" + tid );
        }
        
        if (ship.type != 2  && ship.ai && ship.target )
        {
            var distToTarget = utils.dist( ship.x
                                         , ship.y
                                         , ship.target.x
                                         , ship.target.y
                                         );
            var angleToTarget = utils.getAngle( ship.x
                                              , ship.y
                                              , ship.target.x
                                              , ship.target.y
                                              );
            var angleFromTarget = utils.getAngle( ship.target.x
                                                , ship.target.y
                                                , ship.x
                                                , ship.y
                                                );
            
            while ( ship.angle > 360 )
                ship.angle -= 360;
            while ( ship.angle < 0 )
                ship.angle += 360;
            
            // relativeAngleToTarget
            var relativeATT = utils.wrapedDirection( angleToTarget , ship.angle , 360 );
            // relativeAngleFromTarget
            var relativeAFT = utils.wrapedDirection( angleFromTarget , ship.target.angle , 360 );
            
            if (Math.abs(relativeAFT) < 45)
            {
                ship.turnDirection = -1;
                ship.trustPower = 1;
            }
            else
            {
                if (distToTarget > 15)
                    ship.trustPower = 1;
                else if (distToTarget < 7)
                    ship.trustPower = -1;
                
                if (relativeATT > 0)
                    ship.turnDirection = 1;
                else
                    ship.turnDirection = -1;
            }
        }
        
        if ( ship.ai && ship.type != 2 )
        {
            // TRUST VEL SPEED ETC
            ship.angle += ship.turnDirection;
            ship.turnDirection = 0;
            
            ship.velX += utils.trustX( ship.angle , ship.trustPower/3 );
            ship.velY += utils.trustY( ship.angle , ship.trustPower/3 );
            
            ship.trustPower = 0;
            
            ship.fire();
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
        correctPosition(ship);
        
        if ( ship.life.life <= 0 )
        {
            delete ships[id];
            msgs.push({ type : "rm ship"
                      , id : id
                      });
        }
        else
        {
            msgs.push({ type : "sp"
                      , id : ship.id
                      , x : ship.x
                      , y : ship.y
                      , angle : ship.angle
                      });
            if ( ship.type == 2 )
            {
                if ( ship.team == 1 )
                    team1MS = true;
                else
                    team2MS = true;
            }
        }
    }
}

function initGame()
{
    addShip(1000  , 100 , 1 , 2 );
    addShip(-1000 , 100 , 2 , 2 );
    
    for ( var i = 0 ; i < 50 ; i++ )
    {
        addShip( Math.random()*10000-5000 , Math.random()*10000-5000 , Math.random()>0.5?1:2 , 1 );
    }
}

initGame();

function resetGame()
{
    ships = [];
    
    for ( var i = 0 ; i < players.length ; i++ )
    {
        players[i].send({type:"init game"});
        initPlayerShip(players[i]);
        players[i].id = players[i].ship.id;
        players[i].send( { type : "connected" , id : players[i].id } );
    }
    for ( var i = 0 ; i < deadPlayers.length ; i++ )
    {
        deadPlayers[i].send({type:"init game"});
        players.push(deadPlayers[i]);
        initPlayerShip(deadPlayers[i]);
        deadPlayers[i].id = deadPlayers[i].ship.id;
        deadPlayers[i].send( { type : "connected" , id : deadPlayers[i].id } );
    }
    deadPlayers = [];
    
    initGame();
}

function projsUpdate()
{
    for ( var i = 0 ; i < projs.length ; i++ )
    {
        proj = projs[i];
        
        proj.x += proj.velX;
        proj.y += proj.velY;
        proj.life -= 1;
        
        for ( var id in ships )
        {
            var ship = ships[id];
            if ( ship.team != proj.team && utils.dist2( proj.x , proj.y , ship.x , ship.y ) < 90*90 )
            {
                ship.life.hurt(proj.dmg);
                ship.velX += utils.trustX( proj.angle , 4 );
                ship.velY += utils.trustY( proj.angle , 4 );
                proj.life = -1;
            }
        }
        
        if ( proj.life < 1 )
        {
            projs.splice(i,1);
            i--;
        }
    }
}