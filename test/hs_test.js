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
		this.ct=function(name,ac,ta) {
			return new HS.Type(name,ac,ta);
		}
	}
})

test('eval: simple literal',function(){
	var evvs=this.evvs;
	var evt=this.evt;

	eq(evvs('1'),1);
	eq(evvs('"a"'),"a");

	eq(evt('1'),HS.Type.Number);
	eq(evt('"a"'),HS.Type.Array.apply(HS.Type.Character));
})

test('eval: list',function() {
	var evvl=this.evvl;
	var evvs=this.evvs;
	var evt=this.evt;
	var ev=this.ev;
	var s=this.s;

	eq(ev('()').value(),null);

	var r_123=ev('(1 2 3)');

	eq(r_123.type,HS.Type.Array.apply(HS.Type.Number));
	eq(evvl('(1 2 3)'),[1,2,3]);


	eq(evt('("a" "b")'),
		HS.Type.Array.apply(HS.Type.Array.apply(HS.Type.Character)));

	eq(evt('((1) (1 2))'),
		HS.Type.Array.apply(HS.Type.Array.apply(HS.Type.Numnber)));
	eq(evvl('((1) (1 2))'),[[1],[1,2]]);

	ev('(:bind a 1)');
	eq(evt('(a 2 3)'),HS.Type.Array.apply(HS.Type.Number));

	eq(evvl('(a a)'),[1,1]);
});

test('eval: range',function() {
	var evvl=this.evvl;

	eq(evvl('([..] 1 3)'),[1,2,3]);
});

test('eval: infiniterange',function() {
	eq(this.evvl('([..] 3)',5),[3,4,5,6,7]);
});

test('eval: bind',function() {
	var evvs=this.evvs;
	var evt=this.evt;
	var ev=this.ev;

	ev('(:bind a 1)');

	eq(evvs('a'),1);
	eq(evt('a'),HS.Type.Number);
});

test('eval: refer unbounded name',function(){
	var self=this;
	raises(function(){ self.ev('a')});
});

test('eval: bind double',function(){
	var self=this;
	self.ev('(:bind a 10)');
	raises(function(){ self.ev('(:bind a 100)') });
});

test('eval: type declaration',function(){
	var evvs=this.evvs;
	var evvl=this.evvl;
	var evt=this.evt;
	var ev=this.ev;

	ev('(:def a Number)');
	eq(evt('a'),HS.Type.Number);
	raises(function(){ev('(:bind a "hoge")')});
	ev('(:bind a 100)');
	eq(evt('a'),HS.Type.Number);
	eq(evvs('a'),100);

	ev('(:def b Number)');
	// type mismatch
	raises(function(){ ev('(:bind b "hoge")') });

	// decl for undefined type
	raises(function(){ev('(:def a UndefType)')});

	ev('(:def an (Array Number))');
	ev('(:bind an (1 2 3))');
	eq(evvl('an'),[1,2,3]);
});

test('eval: type decl with type param',function(){
	var ev=this.ev;

	ev('(:def a (Array Number))');
	ok(ev('a').type.isSameType(HS.Type.Array.apply(HS.Type.Number)));
});

test('eval: function type',function(){
	var ev=this.ev;
	var evt=this.evt;
	var T=HS.Type;

	ev('(:def a (-> Number Number))');
	ok(evt('a').isSameType(T.Function.apply(T.Number,T.Number)));

	ev('(:def b (-> Number (Array Number) Number))');
	ok(evt('b').isSameType(
		T.Function.apply(
			T.Number,
			T.Function.apply(
				T.Array.apply(T.Number),
				T.Number))));
});

test('eval: function call',function() {
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

test('eval: define function',function(){
	var ev=this.ev;
	var evvs=this.evvs;

	// TODO: free type ctor argument
	ev('(:def my_head_n (-> (Array Number) Number))');
	ev('(:bind_fun my_head (_x . _xs) _x)');
	eq(evvs('($ my_head (1 2 3))'),1);
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
	eq(ct('A',3).apply(ct('B')).inspect(),'A (B) _1 _2');
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


module('HS.Type');

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
