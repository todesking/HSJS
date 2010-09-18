var HS=function() {
	this.env=new HS.Env(HS.Prelude);
}
HS.prototype={
	eval_s: function(src) {
		return this.eval(new SParser().parseSingle(src));
	},
	eval: function(exp) {
		var self=this;
		var m=new HS.Matcher();
		if(m.match(exp,'($ . (_1 . _2))')) { // function call
			var fun=this.eval(m._[1]);
			if(fun.type.name!='Function') // TODO: Type#kindOf
				throw 'ERROR: attempt to call not function object'
			var args=[];
			for(var c=m._[2];c!==null;c=c.cdr)
				args.push(this.eval(c.car));
			// TODO: arg length check
			return fun.value().apply(args);
		} else if(m.match(exp,'(:bind_fun _n:symbol _pat _body)')) { // funcall
			// TODO: _args:list syntax for matcher
			var declared=this.env.get(m._.n.name);
			if(!declared)
				throw 'functions must be specified argument type before bind body';
			// TODO: type check(Function)
			if(declared.undef) {
				// TODO: static to instance member
				var f=HS.Type.Function.createinstance(declared.type);
				declared.value=function() {return f}
				declared.undef=false;
			}
			var f=declared.value();
			f.addDef(m._.pat,m._.body);
		} else if(m.match(exp,'(:def _1:symbol _2)')) { // type decl
			var name=m._[1].name;
			var type=this.evalType(m._[2]);
			this.env.decl(name,type);
		} else if(m.match(exp,'(:bind _1:symbol _2)')) { // bind value
			var name=m._[1].name;
			var value=this.eval(m._[2]);
			this.env.bind(name,value)
		} else if(m.match(exp,'([..] _1 _2)')) { // range(start,end)
			return this._makeRange(m._[1],m._[2]);
		} else if(m.match(exp,'([..] _1)')) { // range(start)
			return this._makeRange(m._[1],null);
		} else if(m.match(exp,'_1:symbol')) { // lookup
			return this.env.get(m._[1].name);
		} else if(exp===null) {
			return this._makeScalar(exp);
		} else if(exp.isCons) { // list
			return this._makeList(this._arrayTypeOf(exp),exp);
		} else { // const
			return this._makeScalar(exp);
		}
	},
	evalType: function(exp) {
		var m=new HS.Matcher();
		if(m.match(exp,'_1:symbol')) {
			return this.env.getT(m._[1].name);
		} else if(m.match(exp,'(-> . _1)')) {
			var types=[];
			for(var c=m._[1];c!==null;c=c.cdr)
				types.push(this.evalType(c.car));
			return HS.Type.Function.multi(types);
		} else if(m.match(exp,'(_1 . _2)')) {
			var t_ctor=this.evalType(m._[1]);
			var t_args=[];
			for(var c=m._[2];c!==null;c=c.cdr)
				t_args.push(this.evalType(c.car));
			return t_ctor.applyA(t_args);
		} else {
			throw 'Illegal type';
		}
	},
	_scalarTypeOf: function(exp) {
		if(exp===null)
			return HS.Type.Array
		var ts=typeof(exp);
		if(ts=='number') {
			return HS.Type.Number;
		} else if(ts=='string') {
			return HS.Type.Array.apply(HS.Type.Character);
		} else {
			throw 'ERROR: not valid type: '+exp;
		}
	},
	_arrayTypeOf: function(exp) {
		  var types=[];
		  for(var c=exp;c!==null;c=c.cdr) {
			  var v=this.eval(c.car);
			  types.push(v.type);
		  }
		  var t=types[0];
		  for(var i=1;i<types.length;i++) {
			  t=HS.Type.superTypeOf(t,types[i]);
			  if(t===undefined)
				  throw 'ERROR: can\'t inference the list type';
		  }
		  return HS.Type.Array.apply(t);
	},
	_makeScalar: function(exp) {
		return {
			isArray: false,
			type: this._scalarTypeOf(exp),
			value: function(){return exp;}
		}
	},
	_makeList: function(type,cons) {
		var self=this;
		if(cons===null)
			return self._makeScalar(null);
		return {
			isArray: true,
			type: type,
			car: function() { return self.eval(cons.car) },
			cdr: function() { return self._makeList(type,cons.cdr) }
		}
	},
	_makeRange: function(start,end) {
		var self=this;
		return {
			isArray: true,
			type: HS.Type.Array.apply(HS.Type.Number),
			car: function() { return self._makeScalar(start); },
			cdr: function() {
				if(end!==null && start==end)
					return self._makeScalar(null);
				return self._makeRange(start+1,end)
			}
		}
	}
}

HS.Promise=function(val) {
	var forced=false;
	var realValue=null;
	return {
		force: function() {
			if(forced)
				return realValue;
			if(val.__hs_delayed)
				realValue=val.force();
			else
				realValue=val();
			forced=true;
			return realValue;
		},
		__hs_delayed: true
	}
}

HS.Matcher=function() {
}
HS.Matcher.prototype={
	match: function(exp,pat_str) {
		this._={};
		return this._match(exp,new SParser().parseSingle(pat_str));
	},
	_match: function(exp,pat) {
		if(pat===null) {
			return exp===null;
		} else if(pat.isSymbol) {
			var pat_p=/^_([a-zA-Z0-9]*)(?::(symbol))?$/.exec(pat.name);
			if(pat_p) {
				var name=pat_p[1];
				var type=pat_p[2];
				if(!type || (type=='symbol' && exp && exp.isSymbol)) {
					if(name.length>0)
						this._[name]=exp;
					return true;
				} else {
					return false;
				}
			} else {
				return exp && exp.isSymbol && exp.name==pat.name;
			}
		} else if(pat.isCons) {
			return exp &&
				exp.isCons &&
				this._match(exp.car,pat.car) &&
				this._match(exp.cdr,pat.cdr);
		} else {
			return exp===pat;
		}
	}
}

HS.Type=function(name,argsCount,typeArgs) {
	this.name=name;
	this.argsCount=argsCount||0;
	this.typeArgs=typeArgs||[];
}

HS.Type.superTypeOf=function(t1,t2) {
	if(t1.isSameType(t2))
		return t1;
	else return undefined;
}

HS.Type.prototype={
	apply: function() {
		return this.applyA(arguments);
	},
	applyA: function(t_args) {
		return new HS.Type(this.name,this.argsCount,t_args);
	},
	acceptable: function(type) {
		return this.isSameType(type);
	},
	isSameType: function(other) {
		if(this.name!=other.name) return false;
		if(this.typeArgs.length!=other.typeArgs.length) return false;
		for(var i=0;i<this.typeArgs.length;i++)
			if(!this.typeArgs[i].isSameType(other.typeArgs[i])) return false;
		return true;
	},
	inspect: function() {
		var s=this.name;
		var unboundIndex=1;
		for(var i=0;i<this.argsCount;i++) {
			if(i<this.typeArgs.length) {
				s+=' ('+this.typeArgs[i].inspect()+')';
			} else {
				s+=' _'+(unboundIndex++);
			}
		}
		return s;
	}
}

HS.Type.Number=new HS.Type('Number');
HS.Type.Character=new HS.Type('Character');
HS.Type.Array=new HS.Type('Array',1);
HS.Type.Function=new HS.Type('Function',2); // arg_t -> ret_t
HS.Type.Function.createinstance=function(fun_t) {
	var instance={
		type: fun_t,
		value: function() {
			var self=this;
			return {
				apply: function(args) {
					for(var i=0;i<self._defs.length;i++) {
						var d=self._defs[i];
						if(d.accepts(args))
							return d.apply(args);
					}
					// TODO: more information
					throw 'ERROR: No matches';
				}
			}
		},
		addDef: function(pat,body) {
			this._defs.push({
				accepts: function(args) {
					// TODO: do something with pat,args
				},
				apply: function(args) {
					// TODO: do something with pat,args,body
				}
			});
		},
		_defs: []
	};
	return instance;
};
HS.Type.Function.multi=function(arg_ts) {
	var len=arg_ts.length;
	if(len<2) throw 'ERROR: function ctor needs >=2 params';
	var fun_t=HS.Type.Function.apply(arg_ts[len-2],arg_ts[len-1])
	for(var i=len-3; i>=0; i--)
		fun_t=HS.Type.Function.apply(arg_ts[i],fun_t);
	return fun_t;
};
HS.Type.Function.adapterFromNative=function(arg_ts,func) {
	return {
		type: HS.Type.Function.multi(arg_ts),
		value: function(){
			return {
				apply: function(args) {
					var value=func.apply(null,args);
					return {
						type: arg_ts[arg_ts.length-1],
						value: function() { return value; }
					}
				}
			};
		}
	}
};

HS.Env=function(parent) {
	this.parent=parent;
	this.bindings={};
	this.types={};
}
HS.Env.prototype={
	bind: function(name,value) {
		var bounded=this.bindings[name];
		if(bounded) {
			if(bounded.value)
				throw 'ERROR: already bounded: '+name;
			if(!bounded.type.acceptable(value.type))
				throw 'ERROR: type mismatch: '+name+'\'s type is '+
					bounded.type.inspect()+' but value has '+value.type.inspect();
			bounded.undef=false;
			if(value.isArray) {
				bounded.car=value.car;
				bounded.cdr=value.cdr;
				bounded.isArray=true;
			} else {
				bounded.value=value.value;
				bounded.isArray=false;
			}
		} else {
			this.bindings[name]=value;
		}
	},
	decl: function(name,type) {
		var bounded=this.bindings[name];
		if(bounded)
			throw 'ERROR: binding '+name+' is already exists';
		this.bindings[name]={
			type: type,
			undef: true
		};
	},
	get: function(name) {
		return this._get('binding','bindings',name);
	},
	getT: function(name) {
		return this._get('type','types',name);
	},
	_get: function(desc,namespace,name) {
		var found=this[namespace][name];
		if(found) return found;
		if(this.parent) return this.parent._get(desc,namespace,name);
		throw 'ERROR: unbound '+desc+': '+name;
	}
};

HS.Prelude=new HS.Env(null);
HS.Prelude.types={
	Number: HS.Type.Number,
	Character: HS.Type.Character,
	Array: HS.Type.Array,
	String: HS.Type.Array.apply(HS.Type.Character),
	Function: HS.Type.Function
};
