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
		if(m.match(exp,'(:def _1:symbol _2:symbol)')) { // type decl
			var name=m._[1].name;
			var t_name=m._[2].name;
			this.env.decl(name,this.env.getT(t_name));
		} else if(m.match(exp,'(:bind _1:symbol _2)')) { // bind value
			var name=m._[1].name;
			var value=this.eval(m._[2]);
			this.env.bind(name,value)
		} else if(m.match(exp,'_1:symbol')) { // lookup
			return this.env.get(m._[1].name);
		} else if(exp.isCons) { // list
			var types=[];
			for(var c=exp;c!==null;c=c.cdr)
				types.push(this.eval(c.car).type);
			var t=types[0];
			for(var i=1;i<types.length;i++) {
				t=HS.Type.superTypeOf(t,types[i]);
				if(t===undefined)
					throw 'ERROR: can\'t inference the list type';
			}
			return {
				type: HS.Type.Array.apply(t),
				value: new HS.Promise(function() {
					var r=[];
					for(var c=exp;c!==null;c=c.cdr)
						r.push(self.eval(c.car));
					return SExpr.Cons.makeList.apply(null,r);
				})
			};
		} else { // const
			return {
				type: this._typeOf(exp),
				value: new HS.Promise(function(){return exp;})
			}
		}
	},
	_typeOf: function(exp) {
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
		if(pat===null || exp===null) {
			return exp===pat;
		} else if(pat.isSymbol) {
			var pat_p=/^_([a-zA-Z0-9]*)(?::(symbol))?$/.exec(pat.name);
			if(pat_p) {
				var name=pat_p[1];
				var type=pat_p[2];
				if(!type || (type=='symbol' && exp.isSymbol)) {
					if(name.length>0)
						this._[name]=exp;
					return true;
				} else {
					return false;
				}
			} else {
				return  exp.isSymbol && exp.name==pat.name;
			}
		} if(pat.isCons) {
			return exp.isCons &&
				this._match(exp.car,pat.car) &&
				this._match(exp.cdr,pat.cdr);
		} else {
			return exp==pat;
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
		return new HS.Type(this.name,this.argsCount,arguments);
	},
	acceptable: function(type) {
		return this==type;
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
			bounded.value=value.value;
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
			value: undefined
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
	Function: HS.Type.Function
};
