function eq(actual,expected,message) {
	if(!QUnit.equiv(actual,expected)) {
		var jsd=QUnit.jsDump;
		ok(false,['expected ',jsd.parse(expected),'but',jsd.parse(actual)].join(' '));
	}
}

