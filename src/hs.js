var HS=function() {
	this.env=new HS.Env(HS.Prelude);
}
HS.prototype={
	eval_s: function(src) {
		return this.eval(new SParser().parseSingle(src));
	},
	eval: function(exp) {
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
		} else { // const
			return {
				type: this._typeOf(exp),
				value: new HS.Promise(function(){return exp;})
			}
		}
	},
	_typeOf: function(exp) {
		var ts=typeof(exp);
		if(ts=='number') {
			return HS.Type.Number;
		} else if(ts=='string') {
			return HS.Type.Array.apply(HS.Type.Character);
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
		if(pat==null || exp==null) {
			return exp==pat;
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

HS.Type.prototype={
	apply: function(typeArgs) {
		return new HS.Type(this.name,this.argsCount,typeArgs||arguments);
	},
	acceptable: function(type) {
		return this==type;
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
				throw 'ERROR: type mismatch: '+name+' has '+
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
			value: null
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
