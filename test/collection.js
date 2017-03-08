(function() {
	var _ = typeof require == 'function' ? require('..') : window._;

	QUnit.module( 'Collections' );

	QUnit.test( "each", function( assert ) {
		_.each( [ 1, 2, 3 ], function ( num, i ) {
			assert.strictEqual( num, i + 1, 'each iterators provide value and iteration count');
		});

		var answers = [];
		_.each( [ 1, 2, 3 ], function ( num ) {
			answers.push( num * this.multiplier );
		}, { multiplier: 5 });
		assert.deepEqual( answers, [ 5, 10, 15 ], 'context object property accessed');

		answers = [];
		_.each( [ 1, 2, 3 ], function ( num) {
			answers.push( num );
		});
		assert.deepEqual( answers, [ 1, 2, 3 ], 'can iterate a simple array');

		answers = [];
		var obj = { one: 1, two: 2, three: 3 };
		obj.constructor.prototype.four = 4;
		_.each( obj, function ( value, key ) {
			answers.push( key );
		});
		assert.deepEqual( answers, [ 'one', 'two', 'three' ], 'iterating over objects works, and ignores the object prototype.');
		delete obj.constructor.prototype.four;

		// 确保each函数是JITed？
/*		_( 1000 ).times( function () {
			_.each( [], function () {});
		});*/
		var count = 0;
		obj = { 1: 'foo', 2: 'bar', 3: 'baz' };
		_.each( obj, function () { count++; });
		assert.strictEqual( count, 3, 'the fun should be called only 3 times' );

		var answer = null;
		_.each( [ 1, 2, 3 ], function ( num, index, arr ) {
			if ( _.include( arr, num ) ) answer = true;
		});
		assert.ok( answer, 'can reference the original collection from inside the iterator' );

		answers = 0;
		_.each( null, function () { ++answers; } );
		assert.strictEqual( answers, 0, 'handles a null properly' );

		_.each( false, function () {} );

		var a = [ 1, 2, 3 ];
		assert.strictEqual( _.each( a, function () {} ), a );
		assert.strictEqual( _.each( null, function () {} ), null );
	});

	QUnit.test( 'forEach', function ( assert ) {
		assert.strictEqual( _.forEach, _.each, 'is an alias for each' );
	});

	// 看了这个测试才知道，apply和call的时候，context是字面量的话，会先被包装再传
	// 进去
	QUnit.test( 'lookupIterator with contexts', function ( assert ) {
		_.each( [ true, false, 'yes', '', 0, 1, {} ], function ( context ) {
			_.each( [ 1 ], function () {
				assert.strictEqual( typeof this, 'object', 'context is a wrapped primitive' );
				assert.strictEqual( this.valueOf(), context, 'the unwrapped context is the specified primitive' );
			}, context);
		});
	});

	// 测试有length属性但不能归为类数组的
	QUnit.test( 'Iterating objects with sketchy length properties', function ( assert ) {
		var functions = [
			'each', 'map', 'filter', 'find',
			'some', 'every', 'max', 'min',
			'groupBy', 'countBy', 'partition', 'indexBy'
		];
		var reducers = [ 'reduce', 'reduceRight' ];

		// 都会被isArrayLike过滤掉
		var tricks = [
			{ length: '5' },
			// 重写valueOf为一个始终返回5的函数
			{ length: { valueOf: _.constant( 5 ) } },
			{ length: Math.pow( 2, 53 ) + 1 },
			{ length: Math.pow( 2, 53 ) },
			{ length: null },
			{ length: -2 },
			// typeof new Number( 15 ); // "object"
			{ length: new Number( 15 ) }
		];

		// +4 是_.size, _.toArray, _.shuffle, _.sample这几个
		assert.expect( tricks.length * ( functions.length + reducers.length + 4 ) );

		_.each( tricks, function ( trick ) {
			var length = trick.length;
			assert.strictEqual( _.size( trick ), 1, 'size on obj with length: ' + length );
			assert.deepEqual( _.toArray( trick ), [ length ], 'toArray on obj with length: ' + length );
			assert.deepEqual( _.shuffle( trick ), [ length ], 'shuffle on obj with length: ' + length );
			assert.deepEqual( _.sample( trick ), [ length ], 'sample on obj with length: ' + length );


			_.each( functions, function ( method ) {
				_[method]( trick, function ( val, key ) {
					assert.strictEqual( key, 'length', method + ':ran with length = ' + val );
				});
			});

			_.each( reducers, function ( method ) {
				assert.strictEqual( _[method](trick), trick.length, method );
			});

		});
	});

	QUnit.test( 'Resistant to collection length and properties changing while iterating', function ( assert ) {

		var collection = [
			'each', 'map', 'filter', 'find',
			'some', 'every', 'max', 'min',
			'groupBy', 'countBy', 'partition', 'indexBy',
			'reduce', 'reduceRight'
		];
		var array = [
			'findIndex', 'findLastIndex'
		];
		var object = [
			'mapObject', 'findKey', 'pick', 'omit'
		];

		_.each( collection.concat( array ), function ( method ) {
			var sparseArray = [ 1, 2, 3 ];
			sparseArray.length = 100;
			var answers = 0;
			_[ method ]( sparseArray, function () {
				++answers;
				return method === 'every' ? true : null;
			}, {});
			assert.strictEqual( answers, 100, method + ' enumerates [0, length)' );
		});
	});

}())
