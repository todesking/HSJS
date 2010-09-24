module('HS',{
	setup:function(){
		var parser=new SParser();
		var hs=this.hs=new HS();
		this.s=function(src){return parser.parseSingle(src);}
		function expandAll(r,maxLen) {
			if(!r.isArray)
				return r.value();
			var list=[];
			for(var c=r;c.isArray;c=c.cdr()) {
				list.push(expandAll(c.car(),maxLen));
				if(maxLen && list.length>maxLen) {
					list.pop();
					break;
				}
			}
			return list;
		}
		var ev=this.ev=function(src) {
			return hs.eval(parser.parseSingle(src));
		}
		var evv=this.evvs=function(src) {
			var r=ev(src);
			ok(!r.isArray);
			return r.value();
		}
		var evvl=this.evvl=function(src,maxLen) {
			var r=ev(src);
			ok(r.isArray || r.value()===null);
			return expandAll(r,maxLen);
		}
		var evt=this.evt=function(src) {
			return ev(src).type;
		}
	}
})

test('infiniterange',function() {
	eq(this.evvl('([..] 3)',5),[3,4,5,6,7]);
});

test('function call',function() {
	this.hs.env.bind('n2s',
		HS.Type.Function.adapterFromNative(
			[HS.Type.Number,HS.Type.String],
			function(arg) {
				var n=arg.value();
				return ''+n;
			}
		)
	);
	eq(this.evvs('($ n2s 100)'),"100");
});

test('define function',function(){
	var ev=this.ev;
	var evvs=this.evvs;

	// TODO: free type ctor argument
	//ev('(:def my_head_n (-> (Array Number) Number))');
	//ev('(:bind_fun my_head (_x . _xs) _x)');
	//eq(evvs('($ my_head (1 2 3))'),1);
});

module('HS.Promise');

test('promise',function() {
	var P=HS.Promise;
	var f=function(value){return function(){return value;}};
	eq(new P(f(1)).force(),1);

	var p2=new P(function(){return 1+1;});
	var p2_=new P(p2);
	var p10=new P(f(10));
	var p12=new P(function(){return p10.force()+p2_.force()});
	eq(p12.force(),12);
	eq(p12.force(),12);
});


module('HS.Matcher');

test('match: simple',function(){
	var m=new HS.Matcher();
	var s=function(src){return new SParser().parseSingle(src);}
	var ma=function(a,b){return m.match(s(a),b);}

	ok(ma('a','a'));
	ok(!ma('a','b'));
});

test('match: list',function() {
	var m=new HS.Matcher();
	var s=function(src){return new SParser().parseSingle(src);}
	var ma=function(a,b){return m.match(s(a),b);}

	ok(ma('(a b c)','(a b c)'));
	ok(!ma('(a b c)','(a b b)'));
	ok(!ma('(a b c)','(a b c d)'));
	ok(ma('()','()'));
});

test('match: matchvars',function(){
	var m=new HS.Matcher();
	var s=function(src){return new SParser().parseSingle(src);}
	var ma=function(a,b){return m.match(s(a),b);}
	var symbol=function(name){return new SExpr.Symbol(name);}

	ok(ma('a','_1'));
	eq(m._[1],symbol('a'));

	ok(ma('(a b (1 x))','(a _ (_1 _2))'));
	eq(m._[1],1);
	eq(m._[2],symbol('x'));

	ok(ma('()','_1'));
	eq(m._[1],null);
});

test('match: matchvars with type',function(){
	var m=new HS.Matcher();
	var s=function(src){return new SParser().parseSingle(src);}
	var ma=function(a,b){return m.match(s(a),b);}
	var symbol=function(name){return new SExpr.Symbol(name);}

	ok(ma('a','_1:symbol'));
	eq(m._[1],symbol('a'));

	ok(!ma('()','_1:symbol'));
	ok(!ma('1','_1:symbol'));

	ok(ma('(1 a)','(_1 _2:symbol)'));
});


module('HS.Type',{
	setup: function(){
		this.ct=function(name,ac,ta) {
			return new HS.Type(name,ac,ta);
		}
	}
});

test('#isSameType',function() {
	ok(HS.Type.Number.isSameType(HS.Type.Number))
	ok(HS.Type.Array.apply(HS.Type.Number).
		isSameType(HS.Type.Array.apply(HS.Type.Number)));
	ok(!HS.Type.Array.apply(HS.Type.Number).
		isSameType(HS.Type.Number));
	ok(HS.Type.Function.apply(HS.Type.Number,HS.Type.Number).isSameType(
		HS.Type.Function.apply(HS.Type.Number,HS.Type.Number)));
	ok(!HS.Type.Function.apply(HS.Type.Number,HS.Type.Number).isSameType(
		HS.Type.Function.apply(HS.Type.Number,HS.Type.Array)));
});

test('inspect',function(){
	var ct=this.ct;
	eq(ct('Hoge').inspect(),'Hoge')
	eq(ct('A',2).inspect(),'A _1 _2');
	eq(ct('A',2,[]).inspect(),'A _1 _2');
	eq(ct('A',2,[ct('B')]).inspect(),'A (B) _1');
});

test('ctor apply',function() {
	var ct=this.ct;
	eq(ct('A',3).apply(ct('B')).inspect(),'A (B) _1 _2');
});
