var register_hs_highlevel_tests=(function() {
	function register_test(test_name,test_expressions) {
		test(test_name,function() {
			var engine=new HS();
			var m=new HS.Matcher();
			function tryEval(expression) {
				try {
					var result=engine.eval(expression);
					return result;
				} catch(e) {
					ok(false,'evaluation of '+SExpr.inspect(expression)+' should not error: msg='+e);
					throw 'aborted because unexpected error';
				}
			}
			function tryEvalType(expression) {
				try {
					return engine.evalType(expression);
				} catch(e) {
					ok(false,'type evaluation of '+SExpr.inspect(expression)+' should not error: msg='+e);
					throw 'aborted because unexpected error';
				}
			}
			// TODO: not suitable for infinite list
			function forceAll(value) {
				return {
					type: value.type,
					value: function(){
						if(!value.isArray)
							return value.value();
						var list=[];
						for(var c=value; c.isArray; c=c.cdr())
							list.push(forceAll(c.car()).value());
						return SExpr.Cons.makeList.apply(null,list);
					}
				}
			}
			for(var c=test_expressions; c!==null; c=c.cdr) {
				var s=c.car;
				if(m.match(s,'(t:=> _1 _2)')) { // assert
					var expression=m._[1];
					var expected=m._[2];
					var actual=forceAll(tryEval(expression)).value();
					var msg=SExpr.inspect(expression)+' => '+SExpr.inspect(expected);
					eq(expected,actual,msg);
				} else if(m.match(s,'(t:type=> _1 _2)')) {
					var expected=tryEvalType(m._[2]);
					var actual=tryEval(m._[1]).type;
					var msg='typeof '+SExpr.inspect(m._[1])+' should '+expected.inspect()+'. result: '+actual.inspect();
					ok(expected.isSameType(actual),msg);
				} else if(m.match(s,'(t:reset)')) {
					engine=new HS();
				} else if(m.match(s,'(t:should_error . _1)')) {
					var expression=m._[1];
					var thrown=undefined;
					try {
						engine.eval(expression);
					} catch(e) {
						thrown=e;
					}
					var msg=SExpr.inspect(expression)+' should throws exception';
					ok(thrown!==undefined,msg);
				} else {
					try {
						engine.eval(s);
					} catch(e) {
						ok(false,'evaluating '+SExpr.inspect(s)+' should not error: msg='+e);
						return;
					}
				}
			}
		});
	}
	return function(data) {
		var parsed=new SParser().parse(data);
		var m=new HS.Matcher();
		for(var i=0;i<parsed.length;i++) {
			var s=parsed[i];
			if(!m.match(s,'(t:case _1 . _2)'))
				throw 'Test Syntax Error: '+SExpr.inspect(s);
			var test_name=m._[1].isSymbol ? m._[1].name : m._[1];
			var test_expressions=m._[2];
			register_test(test_name,test_expressions);
		}
	}
})();
