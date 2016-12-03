exports.dive = function()
{
    var arg = arguments;
    return function(obj)
    {
        for ( var i = 0 ; i < arg.length ; i++ )
        {
            if (obj != undefined && obj != null)
                obj = obj[arg[i]];
        }
        return obj;
    };
}

exports.diveF = function(name, arg)
{
    return function(obj)
    {
        return obj[name](arg);
    };
}

exports.same = function(x){ return _ => x     ; };
exports.add  = function(x){ return y => x + y ; };
exports.sub  = function(x){ return y => y - x ; };
exports.mult = function(x){ return y => x * y ; };
exports.div  = function(x){ return y => y / x ; };

exports.compose = function()
{
    var fs = arguments;
    
    return function(e)
    {
        for (var i in fs)
            e = fs[i](e);
        return e;
    }
}

exports.nothing = function()
{
    return { type : "nothing"
           , map : function(){ return exports.nothing() ; }
           , default : function(d){ return d ; }
           };
}

exports.just = function(value)
{
    return { type : "just"
           , value : value
           , default : function(){ return this.value ; }
           , map : function(f)
               {
                   return exports.maybe(f(this.value));
               }
           };
}

exports.maybe = function( unsertain )
{
    if ( unsertain == null )
        return exports.nothing();
    else if ( unsertain == undefined )
        return exports.nothing();
    else
        return exports.just(unsertain)
}

exports.maybes = function( maybeList )
{
    return { all : function()
               {
                   var allClear = true;
                   maybeList.map( e => { if (e.type=="nothing") allClear = false ; } );
                   
                   if ( allClear )
                       return Just( maybeList.map( e => e.value ) );
                   else
                       return exports.nothing();
               }
           , justs : function()
               {
                   return just( maybeList.filter( e => e.type == "just" ).map( e => e.value ) );
               }
           };
}

// maybeDo(1,add1,add2) == just(4)
// maybeDo(null,add10)  == nothing()
exports.maybeDo = function()
{
    var arg = arguments;
    
    function f(m){
        m = exports.maybe(m);
        for ( var i = 0 ; i < arg.length ; i++ )
            m = m.map(arg[i]);
        
        if (f.defaultValue != undefined)
            return m.default(f.defaultValue);
        else
            return m;
    }
    
    f.default = function(v){ f.defaultValue = v; return f; }
    
    return f;
}

exports.def = function(ins,def)
{
    return exports.maybe(ins).default(def);
}

exports.fanout = function(f1)
{
    var f = v =>
    {
        return f.fs.map( func => func(v) );
    };
    
    f.fs = [f1];
    
    f.and = nf => { f.fs.push(nf) ; return f };
    
    return f;
}

exports.safeJSONParse = function(s)
{
    try
    {
        return JSON.parse(s);
    }
    catch (e)
    {
        return null;
    }
}

exports.log = function(){ console.log.apply(console,arguments) }

exports.dist2 = function(x,y,x2,y2)
{
    return Math.pow(x-x2,2) + Math.pow(y-y2,2);
}

exports.dist = function(x,y,x2,y2)
{
    return Math.sqrt( exports.dist2(x,y,x2,y2) );
}

exports.trustX = function( angle , power )
{
    return Math.cos(angle * (Math.PI / 180)) * power;
}

exports.trustY = function( angle , power )
{
    return Math.sin((angle * (Math.PI / 180))) * power;
}

exports.getAngle = function( tx , ty , mx , my  )
{
    var deltaX = mx - tx;
    var deltaY = my - ty;
    return (Math.atan2( deltaY , deltaX ))/Math.PI*180;
}

exports.wrapedDirection = function( x , x2 , w )
{
    var r = x - x2;
    
    if (r > w/2) r = -(w-r);
    if (r < -w/2) r = w+r;
    
    return r;
}
