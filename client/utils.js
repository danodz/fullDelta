function trustX( angle , power )
{
    return Math.cos(angle * (Math.PI / 180)) * power;
}

function trustY( angle , power )
{
    return Math.sin((angle * (Math.PI / 180))) * power;
}

dist2 = function(x,y,x2,y2)
{
    return Math.pow(x-x2,2) + Math.pow(y-y2,2);
}

dist = function(x,y,x2,y2)
{
    return Math.sqrt( dist2(x,y,x2,y2) );
}

function collideAABB( box1 , box2 )
{
   if ( Math.abs(box1.x - box2.x) < ((box1.width+box2.width)/2) )
       if ( Math.abs(box1.y - box2.y) < ((box1.height+box2.height)/2) )
           return true;
   return false;
}

function collideMouse( box )
{
    return collideAABB( {x : mousePos.x, y : mousePos.y, width : 1, height : 1}, box );
}
