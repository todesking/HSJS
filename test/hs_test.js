module('HS',{
	setup:function(){
		var parser=new SParser();
		var hs=new HS();
		var ev=this.ev=function(src) {
			return hs.eval(parser.parseSingle(src));
		}
		var evv=this.evv=function(src) {
			return ev(src).value.force();
		}
		var evt=this.evt=function(src) {
			return ev(src).type;
		}
		this.ct=function(name,ac,ta) {
			return new HS.Type(name,ac,ta);
		}
	}
})

test('eval: literal',function(){
	var evv=this.evv;
	var evt=this.evt;

	eq(evv('1'),1);
	eq(evv('"a"'),"a");

	eq(evt('1'),HS.Type.Number);
	eq(evt('"a"'),HS.Type.Array.apply(HS.Type.Character));
})

test('eval: bind',function() {
	var evv=this.evv;
	var evt=this.evt;
	var ev=this.ev;

	ev('(:bind a 1)');

	eq(evv('a'),1);
	eq(evt('a'),HS.Type.Number);
});

test('eval: refer unbound name',function(){
	var self=this;
	raises(function(){ self.ev('a')});
});

test('eval: bind double',function(){
	var self=this;
	self.ev('(:bind a 10)');
	raises(function(){ self.ev('(:bind a 100)') });
});

test('type inspect',function(){
	var ct=this.ct;
	eq(ct('Hoge').inspect(),'Hoge')
	eq(ct('A',2).inspect(),'A _1 _2');
	eq(ct('A',2,[]).inspect(),'A _1 _2');
	eq(ct('A',2,[ct('B')]).inspect(),'A (B) _1');
});

test('type ctor apply',function() {
	var ct=this.ct;
	eq(ct('A',3).apply([ct('B')]).inspect(),'A (B) _1 _2');
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
});

test('match: matchvars with type',function(){
	var m=new HS.Matcher();
	var s=function(src){return new SParser().parseSingle(src);}
	var ma=function(a,b){return m.match(s(a),b);}
	var symbol=function(name){return new SExpr.Symbol(name);}

	ok(ma('a','_1:symbol'));
	eq(m._[1],symbol('a'));

	ok(!ma('1','_1:symbol'));

	ok(ma('(1 a)','(_1 _2:symbol)'));
});
