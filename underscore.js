(function() {
	// self属性返回对窗口自身的只读引用，等价于window属性。源码说用self是为了
	// 支持WebWorker？global是node环境下的全局变量
	var root = typeof self == 'object' && self.self === self && self ||
						typeof global == 'object' && global.global === global && global ||
						this ||
						{};

	var previousUnderscore = root._;

	// 这里为了方便压缩，减小文件体积
	// Array.prototype是没法压缩的，而ArrayProto可能被压缩成a之类的短变量
	var ArrayProto = Array.prototype, ObjProto = Object.prototype;

	// 这里为什么不直接与undefined比较？
	// 因为当前环境不支持Symbol的话，Symbol将是未声明的，而引用一个未声明的变量将
	// 导致错误。对于尚未声明过的变量，只能执行一项操作，即使用typeof操作符检测其
	// 数据类型，返回'undefined'。
	var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

	var push = ArrayProto.push,
			slice = ArrayProto.slice,
			toString = ObjProto.toString,
			hasOwnProperty = ObjProto.hasOwnProperty;

	var nativeIsArray = Array.isArray,
			nativeKeys = Object.keys,
			nativeCreate = Object.create;

	// 把obj包装一下，这个函数要用new调用，包装后就可以愉快地调用_.prototype上面的
	// 方法了，OO用法
	var _ = function( obj ) {
		if ( obj instanceof _ ) return obj;
		// 修复忘了加new的情况
		if ( !( this instanceof _ ) ) return new _( obj );
		this._wrapped = obj;
	};

	// Node环境下，导出_
	// 这里还考虑了exports和module可能是DOM元素的情况
	if ( typeof exports != 'undefined' && !exports.nodeType ) {
		if ( typeof module != 'undefined' && !module.nodeType && module.exports ) {
			exports = module.exports = _;
		}
		// 旧版本的Node api
		exports._ = _;
	} else {
		// 否则是浏览器环境
		root._ = _;
	}

	_.VERSION = '1.8.3';

	// 名字叫optimize callback，用于修复回调函数的this指针丢失问题
	var optimizeCb = function( func, context, argCount ) {
		// void是很少用到的运算符，后面不管跟啥都返回undefined
		// underscore里面跟undefined比较都是这么写的，应该是为了防止undefined值
		// 被意外重写。
		if ( context === void 0 ) return func;
		switch ( argCount ) {
			// 只有一个参数的情况，直接用call就好了
			case 1: return function ( value ) {
				return func.call( context, value );
			};

			// 不提供argCount也归入这类，整个库里这种情况最多，相当于默认情况
			// 3个参数的情况是类似forEach这样的迭代函数要用的回调函数
			case null:
			case 3: return function ( value, index, collection ) {
				return func.call( context, value, index, collection );
			};

			// 4个参数的情况用于reduce和reduceRight函数，后面再看
			case 4: return function ( accumulator, value, index, collection ) {
				return func.call( context, accumulator, value, index, collection );
			};
		}
		// 其实都可以这样写，但apply的效率低，因此通过额外的argCount参数提高效率
		return function () {
			return func.apply( context, arguments );
		};
	};

	var builtinIteratee;

	// 判断传进来的第一个参数，生成合适的回调函数
	// 用的非常多也非常好用的一个函数
	// 如对于查找、排序用的谓词函数，一般传进来之后先就用cb包装一下，可以保证
	// 返回一个可用的谓词函数
	var cb = function( value, context, argCount ) {
		// 导出的iteratee是用户可以自定义的，所以优先考虑
		if ( _.iteratee !== builtinIteratee ) return _.iteratee( value, context );

		// 空值，用默认的_.identity，简单地返回传入的值
		if ( value == null ) return _.identity;

		// 如果传入了一个函数，那就用optimizeCb设好上下文
		if ( _.isFunction( value ) ) return optimizeCb( value, context, argCount );

		// 如果是对象，该对象是filter等函数的参数，提供要匹配的键值对，
		// 因此返回一个判断对象是否匹配特定键值对的函数
		if ( _.isObject( value ) && !_.isArray( value ) ) return _.matcher( value );

		// 传入string、array这样的情况，string值和array元素的值是属性名，因此返回一
		// 个能够返回相应属性的函数
		return _.property( value );
	};

	_.iteratee = builtinIteratee = function( value, context ) {
		return cb( value, context, Infinity );
	};

	// 类似ES6的rest parameters(https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters)
	// 从startIndex后的参数作为一个数组传入
	// 比如把startIndex设为0，函数内部就可以直接把传入的参数当作数组操作，不用再
	// Array.prototype.slice.call( arguments );
	// 也可以很方便地实现后几个参数与第一个参数相乘类似的功能。
	var restArgs = function ( func, startIndex ) {
		// +可以方便地把类型转为Number
		// 没有指定startIndex时，从func形参的最后一个开始，也就意味着在使用restArgs
		// 的时候，可以restArgs( function ( a, rest ) { ... } )
		// rest成为了一个参数数组，可以在...内使用，非常精妙
		startIndex = startIndex == null ? func.length - 1 : +startIndex;
		return function () {
			var length = Math.max( arguments.length - startIndex, 0 ),
					// 要作为一个数组整体传入的部分
					rest = Array( length ),
					index = 0;

			for ( ; index < length; index++ ) {
				rest[ index ] = arguments[ index + startIndex ];
			}

			switch ( startIndex ) {
				case 0: return func.call( this, rest );
				case 1: return func.call( this, arguments[ 0 ], rest );
				case 2: return func.call( this, arguments[ 0 ], arguments [ 1 ], rest);
			}

			// 3以上的情况，其实0,1,2也可以这样，为了效率采用上面简洁的方式
			var args = Array( startIndex + 1 );
			for ( index = 0; index < startIndex; index++ ) {
				args[ index ] = arguments[ index ];
			}
			args[ startIndex ] = rest;
			return func.apply( this, args );
		};
	};

	// 这个函数在提供Object.create的polyfill时(baseCreate)用到，作用是设置一个对象
	// 的原型。先Ctor = proto; 再var obj = new Ctor; 那么obj的[[prototype]]就设为
	// proto了。当然也是考虑到没有setPrototypeOf的情况。
	// 至于把它写在这，而不是放在baseCreate函数内部，应该是考虑到效率问题，否则每
	// 次调用baseCreate都要新建一个函数了。
	var Ctor = function(){};

	var baseCreate = function ( prototype ) {
		if ( !_.isObject( prototype ) ) return {};
		if ( nativeCreate ) return nativeCreate( prototype );

		Ctor.prototype = prototype;
		var result = new Ctor;
		// Ctor用完重置一下
		Ctor.prototype = null;
		return result;
	};

	// 把特定属性名封装在闭包内，返回一个 返回值是对象的特定属性的函数
	var shallowProperty = function ( key ) {
		return function ( obj ) {
			return obj == null ? void 0 : obj[ key ];
		};
	};

	// 可以通过path获取对象的属性或对象的子对象的属性
	var deepGet = function ( obj, path ) {
		var length = path.length;
		for ( var i = 0; i < length; i++ ) {
			if ( obj == null ) return void 0;
			obj = obj[ path[ i ] ];
		}
		return length ? obj : void 0;
	};

	// 判断是不是类数组
	var MAX_ARRAY_INDEX = Math.pow( 2, 53 ) - 1;
	// getLength后面很多函数用到，所以才特地写这么个函数吧
	var getLength = shallowProperty( 'length' );
	var isArrayLike = function ( collection ) {
		var length = getLength( collection );
		return typeof length == 'number' && length >= 0 &&
			length <= MAX_ARRAY_INDEX;
	};

	// 集合函数
	// --------------

	// forEach
	_.each = _.forEach = function ( obj, iteratee, context ) {
		// optimizeCb的默认情况，也可以传入argCount 3
		iteratee = optimizeCb( iteratee, context );
		var i, length;
		if ( isArrayLike( obj ) ) {
			for ( i = 0, length = obj.length; i < length; i++ ) {
				iteratee( obj[ i ], i, obj );
			}
		} else {
			var keys = _.keys( obj );
			for ( i = 0, length = keys.length; i < length; i++ ) {
				iteratee( obj[ keys[ i ] ], keys[ i ], obj );
			}
		}
		return obj;
	};

	// map
	// 这里迭代数组或对象换了一种跟each里面不一样的写法
	_.map = _.collect = function ( obj, iteratee, context ) {
		iteratee = cb( iteratee, context );
		var keys = !isArrayLike( obj ) && _.keys( obj ),
				length = ( keys || obj ).length,
				results = Array( length );

		for ( var index = 0; index < length; index++ ) {
			var currentKey = keys ? keys[ index ] : index;
			results[ index ] = iteratee( obj[ currentKey ], currentKey, obj );
		}
		return results;
	};

	// reduce
	// 值得注意的是用了两层闭包，第一层持久化reducer函数，避免每次_.reduce的时候
	// 都新建reducer函数。第二层中做是否有初值的判断，把回调的上下文设好。
	var createReduce = function ( dir ) {
		var reducer = function( obj, iteratee, memo, initial ) {
			var keys = !isArrayLike( obj ) && _.keys( obj ),
					length = ( keys || obj ).length,
					index = dir > 0 ? 0 : length - 1;

			if ( !initial ) {
				// 如果没有传入初值，memo就设为第一个元素的值，当前值往后挪一位
				memo = obj[ keys ? keys[ index ] : index ];
				index += dir;
			}
			for ( ; index >= 0 && index < length; index += dir ) {
				var currentKey = keys ? keys[ index ] : index;
				memo = iteratee( memo, obj[ currentKey], currentKey, obj );
			}
			return memo;
		};

		return function ( obj, iteratee, memo, context ) {
			// 标识是否传了初值进来
			var initial = arguments.length >= 3;
			return reducer( obj, optimizeCb( iteratee, context, 4 ), memo, initial);
		};
	};

	// 从左到右版，也就是ES6版
	_.reduce = _.foldl = _.inject = createReduce( 1 );

	_.reduceRight = _.foldr = createReduce( -1 );

	_.find = _.detect = function ( obj, predicate, context ) {
		// 根据对象还是数组选用不同的获取给定属性值的方法
		var keyFinder = isArrayLike( obj ) ? _.findIndex : _.findKey;
		var key = keyFinder( obj, predicate, context );
		if ( key !== void 0 && key !== -1 ) return obj[ key ];
	};

	_.filter = _.select = function ( obj, predicate, context ) {
		var results = [];
		predicate = cb( predicate, context );
		_.each( obj, function ( value, index, list ) {
			if ( predicate( value, index, list ) ) results.push( value );
		});
		return results;
	};

	_.reject = function ( obj, predicate, context ) {
		return _.filter( obj, _.negate( cb( predicate ) ), context );
	};

	_.every = _.all = function ( obj, predicate, context ) {
		predicate = cb( predicate, context );
		var keys = !isArrayLike( obj ) && _.keys( obj ),
				length = ( keys || obj ).length;

		for ( var index = 0; index < length; index++ ) {
			var currentKey = keys ? keys[ index ] : index;
			if ( !predicate( obj[ currentKey ], currentKey, obj ) ) return false;
		}
		return true;
	};

	_.some = _.any = function ( obj, predicate, context ) {
		predicate = cb( predicate, context );
		var keys = !isArrayLike( obj ) && _.keys( obj ),
				length = ( keys || obj ).length;

		for ( var index = 0; index < length; index++ ) {
			var currentKey = keys ? keys[ index ] : index;
			if ( predicate( obj[ currentKey ], currentKey, obj ) ) return true;
		}
		return false;
	};

	// guard据说是为了兼容老版本
	_.contains = _.includes = _.include = function ( obj, item, fromIndex, guard) {
		if ( !isArrayLike( obj ) ) obj = _.values( obj );
		if ( typeof fromIndex != 'number' || guard ) fromIndex = 0;
		return _.indexOf( obj, item, fromIndex ) >= 0;
	};

	// obj是一个集合, invoke方法对集合中的每一个元素执行path所指定的方法,args是
	// 调用方法的参数。
	// path可以是一个函数，这样直接到了最后一行method.apply( context, args );
	// 也可以是一个字符串，这样会到method = context[ path ];这一句，效果也差不多，
	// 比较复杂的是path可以是一个数组，比如[ 'data', 'sort']，这样最后一个元素是
	// 方法名，前面的是"寻找context的path"( contextPath )。这就可以实现类似这样
	// 的调用：_.invoke( [ { data: [ 1, 3, 2 ] }, { data: [ 2, 1, 3 ] } ],
	// [ 'data', 'sort' ] );
	// 另一个巧妙的地方是用restArgs对函数进行包装，没有传入第二个startIndex参数，
	// 看restArgs的代码，这样的话第二个参数后面的参数都会作为数组传入，在内部函数
	// 内就成为args，直接可以用于最后一行的apply
	_.invoke = restArgs( function ( obj, path, args ) {
		var contextPath, func;
		if ( _.isFunction( path ) ) {
			func = path;
		} else if ( _.isArray( path ) ) {
			// 最后一项是方法名，前面是"要执行该方法的对象的path"
			contextPath = path.slice( 0, -1 );
			path = path[ path.length - 1 ];
		}
		// 这里的context是obj的每一项
		return _.map( obj, function ( context ) {
			var method = func;
			if ( !method ) {
				if ( contextPath && contextPath.length ) {
					context = deepGet( context, contextPath );
				}
				if ( context == null ) return void 0;
				method = context[ path ];
			}
			return method == null ? method : method.apply( context, args );
		})
	});

	// map的一个用例，返回指定属性组成的数组
	_.pluck = function ( obj, key ) {
		return _.map( obj, _.property( key ) );
	};

	// filter的一个用例,返回含有指定属性的对象数组
	_.where = function ( obj, attrs ) {
		return _.filter( obj, _.matcher( attrs ) );
	};

	// find的一个用例，返回第一个含有指定属性的对象
	_.findWhere = function ( obj, attrs ) {
		return _.find( obj, _.matcher( attrs ) );
	};

	_.max = function ( obj, iteratee, context ) {
		var result = -Infinity, lastComputed = -Infinity,
				value, computed;

		// 不提供迭代函数的话，直接遍历obj的属性找最大
		// typeof iteratee == 'number'？
		if ( iteratee == null || ( typeof iteratee == 'number' &&
			typeof obj[ 0 ] != 'object' ) && obj != null ) {
			obj = isArrayLike( obj ) ? obj : _.values( obj );
			for ( var i = 0, length = obj.length; i < length; i++ ) {
				value = obj[ i ];
				if ( value != null && value > result ) {
					result = value;
				}
			}
		} else {
			// 提供了迭代函数的话每一项用迭代函数算结果
			iteratee = cb( iteratee, context );
			_.each( obj, function ( v, index, list ) {
				computed = iteratee( v, index, list );
				if ( computed > lastComputed || computed === -Infinity &&
					result === -Infinity ) {
					result = v;
					lastComputed = computed;
				}
			});
		}
		return result;
	};

	_.min = function ( obj, iteratee, context ) {
		var result = Infinity, lastComputed = Infinity,
				value, computed;

		if ( iteratee == null || ( typeof iteratee == 'number' &&
			typeof obj[ 0 ] != 'object' ) && obj != null ) {
			obj = isArrayLike( obj ) ? obj : _.values( obj );
			for ( var i = 0, length = obj.length; i < length; i++ ) {
				value = obj[ i ];
				if ( value != null && value < result ) {
					result = value;
				}
			}
		} else {
			iteratee = cb( iteratee, context );
			_.each( obj, function ( v, index, list ) {
				computed = iteratee( v, index, list );
				if ( computed < lastComputed || computed === Infinity &&
					result === Infinity ) {
					result = v;
					lastComputed = computed;
				}
			});
		}
		return result;
	};

	// 洗牌，打乱一个集合中值的顺序
	_.shuffle = function ( obj ) {
		return _.sample( obj, Infinity );
	};

	// 随机返回一个集合中n个值
	_.sample = function ( obj, n, guard ) {
		// 没提供n的话，就返回一个值
		// 这里用n==null来进行判断可以匹配null或者undefined值，不会匹配''和0，所以
		// 这个库里大量用到== null来判断是否传入了值
		if ( n == null || guard ) {
			// _.values把一个对象的所有属性值作为一个数组返回
			if ( !isArrayLike( obj ) ) obj = _.values( obj );
			// _.random返回两个值之间的一个随机整数，只提供一个参数就是0到它之间
			return obj[ _.random( obj.length - 1 ) ];
		}
		var sample = isArrayLike( obj ) ? _.clone( obj ) : _.values( obj );
		var length = getLength( sample );
		// Math.min和Math.max的小技巧，省去了逻辑判断
		n = Math.max( Math.min( n, length ), 0 );
		var last = length - 1;
		// 这样的算法是等概率地返回了n个值？
		for ( var index = 0; index < n; index++ ) {
			var rand = _.random( index, last );
			var temp = sample[ index ];
			sample[ index ] = sample[ rand ];
			sample[ rand ] = temp;
		}
		return sample.slice( 0, n );
	};

	_.sortBy = function ( obj, iteratee, context ) {
		var index = 0;
		iteratee = cb( iteratee, context );
		// 先用_.map算排序依据值criteria，还返回了index，用于后面sort，value用于最后
		// pluck
		return _.pluck( _.map( obj, function ( value, key, list ) {
			return {
				value: value,
				index: index++,
				criteria: iteratee( value, key, list )
			};
			// 用依据值排序
		}).sort( function ( left, right ) {
			var a = left.criteria;
			var b = right.criteria;
			if ( a !== b ) {
				// 在ab不相等的情况下还考虑了可能有undefined值的情况
				// 因为像1>undefined是不成立的
				if ( a > b || a === void 0 ) return 1;
				if ( a < b || b === void 0 ) return -1;
			}
			// 相等的话，不改变相对顺序
			return left.index - right.index;
			// 最后用_.pluck把value组成的数组返回，即排序结果
		}), 'value' );
	};

	// 分组的辅助函数
	// partition专门用来指示是否用于生成_.partition函数
	var group = function( behavior, partition ) {
		return function ( obj, iteratee, context ) {
			// 用于_.partition的话，新建两个数组分别存分组结果的第一组和第二组
			var result = partition ? [ [], [] ] : {};
			iteratee = cb( iteratee, context );
			_.each( obj, function ( value, index ) {
				// 用iteratee算分组依据值
				var key = iteratee( value, index, obj );
				behavior( result, value, key );
			});
			return result;
		};
	};

	_.groupBy = group( function ( result, value, key ) {
		if ( _.has( result, key ) ) result[ key ].push( value );
		else result[ key ] = [ value ];
	});

	// 类似groupBy，适用于索引值唯一的情况
	_.indexBy = group( function ( result, value, key ) {
		result[ key ] = value;
	});

	_.countBy = group( function ( result, value, key ) {
		if ( _.has( result, key ) ) result[ key ]++;
		else result[ key ] = 1;
	});

	// UTF-16代理对，反正就是能表示所有单个字符吧；用在下面toArray的string情况下，
	// 通过match把每个字符匹配，返回所有匹配组成的数组
	var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;

	_.toArray = function ( obj ) {
		if ( !obj ) return [];
		// 是Array为什么不直接返回obj?
		if ( _.isArray( obj ) ) return slice.call( obj );
		if ( _.isString( obj ) ) {
			// match方法参数是全局匹配正则的时候，返回所有匹配项组成的数组
			// 如果不是/g的话，就只返回第一个匹配了
			return obj.match( reStrSymbol );
		}
		if ( isArrayLike( obj ) ) return _.map( obj, _.identity );
		return _.values( obj );
	};

	_.size = function ( obj ) {
		if ( obj == null ) return 0;
		return isArrayLike( obj ) ? obj.length : _.keys( obj ).length;
	};

	// 把一个集合分成两个数组
	_.partition = group( function ( result, value, pass ) {
		result[ pass ? 0 : 1 ].push( value );
	}, true);

	// 数组方法
	// ------------

	_.first = _.head = _.take = function ( array, n, guard ) {
		if ( array == null || array.length < 1 ) return void 0;
		if ( n == null || guard ) return array[ 0 ];
		return _.initial( array, array.length - n );
	};

	// 除了后面n个都返回
	_.initial = function ( array, n, guard ) {
		return slice.call( array, 0, Math.max( 0, array.length - ( n == null || guard ? 1 : n ) ) );
	};

	_.last = function ( array, n, guard ) {
		if ( array == null || array.length < 1 ) return void 0;
		if ( n == null || guard ) return array[ array.length - 1 ];
		return _.rest( array, Math.max( 0, array.length - n ));
	};

	// 除了前面n个都返回
	_.rest = _.tail = _.drop = function ( array, n, guard ) {
		return slice.call( array, n == null || guard ? 1 : n );
	};

	// 去掉所有falsy值（可以转换成false的值）
	// 利用了filter，对每一项调用Boolean，只有为true的才会留下
	_.compact = function ( array ) {
		return _.filter( array, Boolean );
	};

	// _.flatten的递归辅助函数
	var flatten = function ( input, shallow, strict, output ) {
		output = output || [];
		var idx = output.length;
		for ( var i = 0, length = getLength( input ); i < length; i++ ) {
			var value = input[ i ];
			if ( isArrayLike( value ) && ( _.isArray( value ) || _.isArguments( value ))) {
				if ( shallow ) {
					var j = 0, len = value.length;
					while ( j < len ) output[ idx++ ] = value[ j++ ];
				} else {
					flatten( value, shallow, strict, output );
					idx = output.length;
				}
			// strict模式下，不输出不是类数组的输入
			} else if ( !strict ) {
				output[ idx++ ] = value;
			}
		}
		return output;
	};

	// flatten(磨平)
	// 将一个嵌套多层的数组转换为只有一层的数组，shallow(浅)为true的话，数组将只
	// 减少一维的嵌套
	_.flatten = function ( array, shallow ) {
		return flatten( array, shallow, false );
	};

	// 返回一个不包含一些值的数组
	// 利用restArgs把这些值包装成一个数组，调用difference
	// 这样效率不低吗...先包装成一个数组，difference里面又磨平成一个数组
	_.without = restArgs( function ( array, otherArray ) {
		return _.difference( array, otherArray );
	});

	// 返回array去重后的副本，用户可以传入isSorted为true来加快函数的运行
	// 如果要处理对象元素，传入iteratee函数来获取要对比的属性
	_.uniq = _.unique = function ( array, isSorted, iteratee, context ) {
		// 这是没有传入isSorted的情况
		if ( !_.isBoolean( isSorted ) ) {
			context = iteratee;
			iteratee = isSorted;
			isSorted = false;
		}
		if ( iteratee != null ) iteratee = cb( iteratee, context );
		var result = [];
		var seen = [];
		for ( var i = 0, length = getLength( array ); i < length; i++ ) {
			var value = array[ i ],
					computed = iteratee ? iteratee( value, i, array ) : value;
			// 有序的情况
			if ( isSorted ) {
				// 第一个元素直接push，或者和当前记录下的值不一样，也push
				if ( !i || seen !== computed ) result.push( value );
				seen = computed;
			// 处理的是对象，用_.contains判断属性值是不是在seen里面
			} else if ( iteratee ) {
				if ( !_.contains( seen, computed ) ) {
					seen.push( computed );
					result.push( value );
				}
			// 简单的数组，直接看result里面有没有该元素了
			} else if ( !_.containes( result, value ) ) {
				result.push( value );
			}
		}
		return result;
	};

	_.union = restArgs( function ( arrays ) {
		return _.uniq( flatten( arrays, true, true ) );
	});

	// 交集，array是第一个数组
	_.intersection = function ( array ) {
		var result = [];
		var argsLength = arguments.length;
		for ( var i = 0, length = getLength( array ); i < length; i++ ) {
			var item = array[ i ];
			// 又遇到已经确定是交集内的值，跳过
			if ( _.contains( result, item ) ) continue;
			var j;
			for ( j = 1; j < argsLength; j++ ) {
				// 有一个数组不包含，就跳出循环，那么j就不会等于argsLength了
				if ( !_.contains( arguments[ j ], item ) ) break;
			}
			if ( j === argsLength ) result.push( item );
		}
		return result;
	};

	// 类似于without，但返回的值来自array数组，且不存在于其他数组中
	_.difference = restArgs( function ( array, rest ) {
		rest = flatten( rest, true, true );
		return _.filter( array, function ( value ) {
			return !_.contains( rest, value );
		});
	});

	// 给定若干arrays，返回一串联的新数组，其第一元素包含
	// 所有的输入数组的第一元素，其第二元素包含了所有的第二元素，依此类推。
	// _.unzip([["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]);
	// => [['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]]
	_.unzip = function ( array ) {
		// &&比||优先级高
		var length = array && _.max( array, getLength ).length || 0;
		var result = Array( length );
		for ( var index = 0; index < length; index++ ) {
			result[ index ] = _.pluck( array, index );
		}
		return result;
	};

	// 将每个array中相应位置的值合并在一起，在合并分开保存的数据时很有用
	// 如_.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
	// => [["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]
	// 仔细一看，_.unzip本身就是“可逆的”，输出再当作输入就可以得到之前的输入
	// 所以_.zip只要利用_.unzip就好了。这两也不是简单的相对的操作，_.zip输入是
	// 几个数组
	_.zip = restArgs( _.unzip );

	var createPredicateIndexFinder = function ( dir ) {
		return function ( array, predicate, context ) {
			predicate = cb( predicate, context );
			var length = getLength( array );
			var index = dir > 0 ? 0 : length - 1;
			for ( ; index >= 0 && index < length; index += dir ) {
				if ( predicate( array[ index ], index, array )) return index;
			}
			return -1;
		};
	};

	// 返回符合断言的第一个元素的index
	_.findIndex = createPredicateIndexFinder( 1 );
	_.findLastIndex = createPredicateIndexFinder( -1 );

	// 排好序的数组找插入位置，用到了二分查找
	_.sortedIndex = function ( array, obj, iteratee, context ) {
		iteratee = cb( iteratee, context, 1 );
		var value = iteratee( obj );
		var low = 0, high = getLength( array );
		while ( low < high ) {
			var mid = Math.floor( ( low + high ) / 2 );
			if ( iteratee( array[ mid ] ) < value ) low = mid + 1; else high = mid;
		}
		return low;
	};

	// 生成_.indexOf和_.lastIndexOf的辅助函数
	var createIndexFinder = function ( dir, predicateFind, sortedIndex ) {
		return function ( array, item, idx ) {
			var i = 0, length = getLength( array );
			// idx可以传入true或数字，详细看下面
			// 传入数字即索引，即从该索引后开始查找
			if ( typeof idx == 'number' ) {
				if ( dir > 0 ) {
					// idx可以是负的，指示倒数的第-idx个位置
					i = idx >= 0 ? idx : Math.max( idx + length, i );
				} else {
					// 从后往前找的情况，相当于缩短length咯
					length = idx >= 0 ? Math.min( idx + 1, length ) : idx + length + 1;
				}
			// idx可以是true，用来指示数组已经是有序的，这样
			// 就会使用_.sortedIndex找插入位置，比较该位置的元素是不是要找的。
			// 因为_.sortedIndex使用二分查找效率会比较高，当然需要用户显式指明数组
			// 是有序的
			} else if ( sortedIndex && idx && length ) {
				idx = sortedIndex( array, item );
				return array[ idx ] === item ? idx : -1;
			}
			// 找NaN的情况，这都考虑到了...
			// 不能用===来找了，那就把范围内元素组成数组，用findIndex或findLastIndex来
			// 找
			if ( item !== item ) {
				idx = predicateFind( slice.call( array, i, length ), _.isNaN );
				return idx >= 0 ? idx + i : -1;
			}
			// 特殊情况考虑完，范围限定完，可以开始遍历找了
			for ( idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir ) {
				if ( array[ idx ] === item ) return idx;
			}
			return -1;
		};
	};

	_.indexOf = createIndexFinder( 1, _.findIndex, _.sortedIndex );
	_.lastIndexOf = createIndexFinder( -1, _.findLastIndex );

	// 生成等差数列
	_.range = function ( start, stop, step ) {
		if ( stop == null ) {
			stop = start || 0;
			start = 0;
		}
		if ( !step ) {
			step = stop < start ? -1 : 1;
		}

		var length = Math.max( Math.ceil( ( stop - start ) / step ), 0 );
		var range = Array( length );

		for ( var idx = 0; idx < length; idx++, start += step ) {
			range[ idx ] = start;
		}

		return range;
	};

	// 返回原数组的分块
	_.chunk = function ( array, count ) {
		if ( count == null || count < 1 ) return [];
		var result = [];
		var i = 0, length = array.length;
		while ( i < length ) {
			result.push( slice.call( array, i, i += count ) );
		}
		return result;
	};

	// 函数方法
	// ---------

	var executeBound = function ( sourceFunc, boundFunc, context, callingContext, args ) {
		// 正常情况都在这里返回了，callingContext是boundFunc的实例是什么情况？
		if ( !( callingContext instanceof boundFunc ) ) return sourceFunc.apply( context, args );
		var self = baseCreate( sourceFunc.prototype );
		var result = sourceFunc.apply( self, args );
		if ( _.isObject( result ) ) return result;
		return self;
	};

	_.bind = restArgs( function ( func, context, args ) {
		if ( !_.isFunction( func ) ) throw new TypeError( 'Bind must be called on a function' );
		var bound = restArgs( function ( callArgs ) {
			return executeBound( func, bound, context, this, args.concat( callArgs ));
		});
		return bound;
	});

	_.partial = restArgs( function ( func, boundArgs ) {
		var placeholder = _.partial.placeholder;
		var bound = function () {
			var position = 0, length = boundArgs.length;
			var args = Array( length );
			for ( var i = 0; i < length; i++ ) {
				args[ i ] = boundArgs[ i ] === placeholder ? arguments[ position++ ] : boundArgs[ i ];
			}
			while ( position < arguments.length ) args.push( arguments[ position++ ]);
			return executeBound( func, bound, this, this, args );
		};
		return bound;
	});

	// 分部函数的占位符
	_.partial.placeholder = _;

	// 把一个对象上的一组方法的上下文都设为它本身
	// 这样引用该对象方法的时候this值不会丢失
	_.bindAll = restArgs( function ( obj, keys ) {
		keys = flatten( keys, false, false );
		var index = keys.length;
		if ( index < 1 ) throw new Error( 'bindAll must be passed function names');
		while ( index-- ) {
			var key = keys[ index ];
			obj[ key ] = _.bind( obj[ key ], obj );
		}
	});

	// 还提供了一个hasher函数，调用时候可以传入从而把多个值映射成一个address，便于
	// cache中的存放
	_.memoize = function ( func, hasher ) {
		var memoize = function ( key ) {
			var cache = memoize.cache;
			var address = '' + ( hasher ? hasher.apply( this, arguments ) : key );
			if ( !_.has( cache, address ) ) cache[ address ] = func.apply( this, arguments );
			return cache[ address ];
		};
		memoize.cache = {};
		return memoize;
	};

	_.delay = restArgs( function ( func, wait, args ) {
		return setTimeout( function () {
			return func.apply( null, args );
		}, wait );
	});

	// 设定了wait=1的delay版本，直到当前调用栈清空时，才调用函数。对于处理昂贵的
	// 计算过程或大量的html渲染很有用，不会阻塞UI更新线程。（因为在js执行的时候，
	// 浏览器页面渲染的所有更新操作都要暂停）
	_.defer = _.partial( _.delay, _, 1 );

	// 不是很懂
	_.throttle = function ( func, wait, options ) {
		var timeout, context, args, result;
		var previous = 0;
		if ( !options ) options = {};

		var later = function () {
			previous = options.leading === false ? 0 : _.now();
			timeout = null;
			result = func.apply( context, args );
			if ( !timeout ) context = args = null;
		};

		var throttled = function () {
			var now = _.now();
			if ( !previous && options.leading === false ) previous = now;
			var remaining = wait - ( now - previous );
			context = this;
			args = arguments;
			if ( remaining <= 0 || remaining > wait ) {
				if ( timeout ) {
					clearTimeout( timeout );
					timeout = null;
				}
				previous = now;
				result = func.apply( context, args );
				if ( !timeout ) context = args = null;
			} else if ( !timeout && options.trailing !== false ) {
				timeout = setTimeout( later, remaining );
			}
			return result;
		};

		throttled.cancel = function () {
			clearTimeout( timeout );
			previous = 0;
			timeout = context = args = null;
		};

		return throttled;
	};

	// 对于高频率调用的函数很有用，只在最后一次调用之后wait毫秒才调用一次，
	// 比如为窗口大小改变注册的回调函数。
	// 实现非常精妙
	_.debounce = function ( func, wait, immediate ) {
		var timeout, result;

		var later = function ( context, args ) {
			// 当前轮次已经结束，把timeout置空等待下一轮次
			timeout = null;
			// 这里检查了args值，注意immediate的情况下，args是空的，也就是不会再
			// 执行函数了。而非immdiate情况下，函数在这里得到调用。
			if ( args ) result = func.apply( context, args );
		};

		var debounced = restArgs( function ( args ) {
			// 每次进来都会把前一次设的定时器清掉，所以只有最后一次那个定时器生效
			// 即产生了最后一次函数调用后wait时间后执行函数的效果。
			if ( timeout ) clearTimeout( timeout );
			// 设了immediate，那么第一次进来就会调用
			if ( immediate ) {
				// 后面进来的因为timout一直有值,得不到调用
				var callNow = !timeout;
				// 直到wait时间后later函数里把timeout设为null
				// 这样下一轮函数高频调用时，第一次调用可以执行
				timeout = setTimeout( later, wait );
				if ( callNow ) result = func.apply( this, args );
			} else {
				// 非immediate情况，在wait时间后调用即可，如前所述，每次调用都会清除
				// 前一个定时器，所以只有最后一次的定时器生效
				timeout = _.delay( later, wait, this, args );
			}

			return result;
		});

		debounced.cancel = function () {
			clearTimeout( timeout );
			timeout = null;
		};

		return debounced;
	};

	// 第二个函数柯里化，预设了第一个函数作为参数
	// 比如实现 第二个函数执行完后再执行第一个函数 这样的功能时很有用
	_.wrap = function ( func, wrapper ) {
		return _.partial( wrapper, func );
	};

	_.negate = function ( predicate ) {
		return function () {
			return !predicate.apply( this, arguments );
		};
	};

	// 返回一组函数形成的组，每一个函数用紧跟的下一个函数的返回值作为参数
	_.compose = function () {
		var args = arguments;
		var start = args.length - 1;
		return function () {
			var i = start;
			var result = args[ start ].apply( this, arguments );
			while ( i-- ) result = args[ i ].call( this, result );
			return result;
		};
	};

	// times次及之后调用的时候才会调用的函数
	_.after = function ( times, func ) {
		return function () {
			if ( --times < 1 ) {
				return func.apply( this, arguments );
			}
		};
	};

	// times次之前调用才会调用的函数，之后一直返回最后一次调用的结果
	_.before = function ( times, func ) {
		var memo;
		return function () {
			if ( --times > 0 ) {
				memo = func.apply( this, arguments );
			}
			if ( times <= 1 ) func = null;
			return memo;
		};
	};

	// NB
	_.once = _.partial( _.before, 2 );

	_.restArgs = restArgs;


	// 对象方法
	// ----------

	// 测试toString是否可枚举，IE < 9会有不可枚举的bug
	var hasEnumBug = !{ toString: null }.propertyIsEnumerable( 'toString' );
	// 该bug涉及到的属性
	var nonEnumerableProps = [ 'valueOf', 'isPrototypeOf', 'toString',
										'propertyIsEnumerable', 'hasOwnProperty', 'toLocalString' ];

	// 用于_.keys等方法，把这些遗漏的属性加上去
	var collectNonEnumProps = function ( obj, keys ) {
		var nonEnumIdx = nonEnumerableProps.length;
		var constructor = obj.constructor;
		var proto = _.isFunction( constructor ) && constructor.prototype || ObjProto;

		// constructor是特殊情况，对象和原型上的constructor是一样的，不能用下面的
		// 判断
		var prop = 'constructor';
		if ( _.has( obj, prop ) && !_.contains( keys, prop )) keys.push( prop );

		while ( nonEnumIdx-- ) {
			prop = nonEnumerableProps[ nonEnumIdx ];
			// 不把原型上的包括进来，这和上面那个有什么区别？
			if ( prop in obj && obj[ prop ] !== proto[ prop ] && !_.contains( keys, prop )) {
				keys.push( prop );
			}
		}
	};

	_.keys = function ( obj ) {
		if ( !_.isObject( obj ) ) return [];
		if ( nativeKeys ) return nativeKeys( obj );
		var keys = [];
		for ( var key in obj ) if ( _.has( obj, key ) ) keys.push( key );
		// IE < 9
		if ( hasEnumBug ) collectNonEnumProps( obj, keys );
		return keys;
	};

	// 原型上的也包括
	_.allKeys = function ( obj ) {
		if ( !_.isObject( obj ) ) return [];
		var keys = [];
		for ( var key in obj ) keys.push( key );
		if ( hasEnumBug ) collectNonEnumProps( obj, keys );
		return keys;
	};

	// 不用for in 遍历，用_.keys，避免再收集一遍遗漏的属性
	_.values = function ( obj ) {
		var keys = _.keys( obj );
		var length = keys.length;
		var values = Array( length );
		for ( var i = 0; i < length; i++ ) {
			values[ i ] = obj[ keys[ i ] ];
		}
		return values;
	};

	// 专用于对象上的map，返回一个对象
	_.mapObject = function ( obj, iteratee, context ) {
		iteratee = cb( iteratee, context );
		var keys = _.keys( obj ),
				length = keys.length,
				results = {};
		for ( var index = 0; index < length; index++ ) {
			var currentKey = keys[ index ];
			results[ currentKey ] = iteratee( obj[ currentKey ], currentKey, obj );
		}
		return results;
	};

	// 返回对象的键值对组成的数组
	_.pairs = function ( obj ) {
		var keys = _.keys( obj );
		var length = keys.length;
		var pairs = Array( length );
		for ( var i = 0; i < length; i++ ) {
			pairs[ i ] = [ keys[ i ], obj[ keys[ i ] ] ];
		}
		return pairs;
	};

	// 交换key和value
	_.invert = function ( obj ) {
		var result = {};
		var keys = _.keys( obj );
		for ( var i = 0, length = keys.length; i < length; i++ ) {
			result[ obj[ keys[ i ] ] ] = keys[ i ];
		}
		return result;
	};

	// 对象上的方法名
	// IE < 9不会漏掉上面那些吗？
	_.functions = _.methods = function ( obj ) {
		var names = [];
		for ( var key in obj ) {
			if ( _.isFunction( obj[ key ] ) ) names.push( key );
		}
		return names.sort();
	};

	// 用于_.extend,_.extendOwn和_.defaults的工厂方法
	var createAssigner = function ( keysFunc, defaults ) {
		return function ( obj ) {
			var length = arguments.length;
			// 为什么要obj = Object( obj )？
			if ( defaults ) obj = Object( obj );
			if ( length < 2 || obj == null ) return obj;
			// 第二个及后面的参数的属性都复制到obj上
			for ( var index = 1; index < length; index++ ) {
				var source = arguments[ index ],
						keys = keysFunc( source ),
						l = keys.length;
				for ( var i = 0; i < l; i++ ) {
					var key = keys[ i ];
					// _.defaults只要obj上undefined的属性
					if ( !defaults || obj[ key ] === void 0 ) obj[ key ] = source[ key ];
				}
			}
			return obj;
		};
	};

	// 扩展source上的所有属性
	_.extend = createAssigner( _.allKeys );

	// Object.assign
	// 扩展source上的自身属性
	_.extendOwn = _.assign = createAssigner( _.keys );

	// 返回一个对象，此对象填充了原obj值是undefined的属性
	// 用法实例：
	// var person = {name : undefined,age : 1};
	// var defaultPerson = {name:'unknown',age :0,sex:'male'};
	// var p = _.defaults(person,defaultPerson,{work:'nowork'});
	// console.dir(p);//=>{name:'unknow',age:1,sex:'male',work:'nowork'};
	_.defaults = createAssigner( _.allKeys, true );

	// 查找第一个符合要求的key
	_.findKey = function ( obj, predicate, context ) {
		predicate = cb( predicate, context );
		var keys = _.keys( obj ), key;
		for ( var i = 0, length = keys.length; i < length; i++ ) {
			key = keys[ i ];
			if ( predicate( obj[ key ], key, obj ) ) return key;
		}
	};

	// 单独写出来也是为了符合iteratee的形式
	// iteratee是整个库里很重要的一种抽象
	var keyInObj = function ( value, key, obj ) {
		return key in obj;
	};

	// 返回一个只包含指定属性的对象
	_.pick = restArgs( function ( obj, keys ) {
		var result = {}, iteratee = keys[ 0 ];
		if ( obj == null ) return result;
		// 第二个参数传入函数的情况
		// 类似这样的调用_.pick( obj, predicate, context )
		if ( _.isFunction( iteratee ) ) {
			if ( keys.length > 1 ) iteratee = optimizeCb( iteratee, keys[ 1 ] );
			keys = _.allKeys( obj );
		} else {
			// 否则就是常用的 keys都是要取的属性 这种情况
			iteratee = keyInObj;
			keys = flatten( keys, false, false );
			obj = Object( obj );
		}
		for ( var i = 0, length = keys.length; i < length; i++ ) {
			var key = keys[ i ];
			var value = obj[ key ];
			if ( iteratee( value, key, obj ) ) result[ key ] = value;
		}
		return result;
	});

	// 返回一个不包含指定属性的对象
	// 利用_.pick把不在keys里的都取出来
	_.omit = restArgs( function ( obj, keys ) {
		var iteratee = keys[ 0 ], context;
		// 如果传入了谓词函数
		if ( _.isFunction( iteratee ) ) {
			iteratee = _.negate( iteratee );
			if ( keys.length > 1 ) context = keys[ 1 ];
		} else {
			// 否则，先把keys都转成string，为啥？上面_.pick都没有
			keys = _.map( flatten( keys, false, false ), String );
			iteratee = function ( value, key ) {
				return !_.contains( keys, key );
			};
		}
		return _.pick( obj, iteratee, context );
	});

	// Object.create
	_.create = function ( prototype, props ) {
		var result = baseCreate( prototype );
		if ( props ) _.extendOwn( result, props );
		return result;
	};

	// 浅拷贝
	_.clone = function ( obj ) {
		if ( !_.isObject( obj ) ) return obj;
		return _.isArray( obj ) ? obj.slice() : _.extend( {}, obj );
	};

	// 在一个方法链中tap into一个方法，目的是在链中的中间结果上做操作
	_.tap = function ( obj, interceptor ) {
		interceptor( obj );
		return obj;
	};

	// 判断object是否有指定的键值对集合
	_.isMatch = function ( object, attrs ) {
		var keys = _.keys( attrs ), length = keys.length;
		// 空对象有空键值对，没有非空键值对
		if ( object == null ) return !length;
		var obj = Object( object );
		for ( var i = 0; i < length; i++ ) {
			var key = keys[ i ];
			if ( attrs[ key ] !== obj[ key ] || !( key in obj ) ) return false;
		}
		return true;
	};

	var eq, deepEq;
	eq = function ( a, b, aStack, bStack ) {
		// 如果相等，还要考虑0和-0的情况，0和-0应该不相等，但0===-0会是true
		// 如果a===0，继续进行除零判断，1/0 === 1/0;//true 1/0 === 1/-0;//false
		if ( a === b ) return a !== 0 || 1 / a === 1 / b;
		// null和undefined只应该等于它们自身
		if ( a == null || b == null ) return false;
		// NaN?
		if ( a !== a ) return b !== b;
		var type = typeof a;
		if ( type !== 'function' && type !== 'object' && typeof b != 'object' )
			return false;
		return deepEq( a, b, aStack, bStack );
	};

	deepEq = function ( a, b, aStack, bStack ) {
		//
		if ( a instanceof _ ) a = a._wrapped;
		if ( b instanceof _ ) b = b._wrapped;
		var className = toString.call( a );
		if ( className !== toString.call( b ) ) return false;
		switch( className ) {
			// 分类比较
			// String, number, regexp, data, boolean比较值即可
			// RegExp和string都转成string比较
			case '[object RegExp]':
			case '[object String]':
				return '' + a === '' + b;
			case '[object Number]':
				if ( +a !== +a ) return +b !== +b;
				return +a === 0 ? 1 / +a === 1 / b : +a === +b;
			case '[object Date]':
			case '[object Boolean]':
				return +a === +b;
			case '[object Symbol]':
				return SymbolProto.valueOf.call( a ) === SymbolProto.valueOf.call( b );
		}

		var areArrays = className === '[object Array]';
		if ( !areArrays ) {
			if ( typeof a != 'object' || typeof b != 'object' ) return false;

			// constructor不同的对象不相等
			// 但要排除来自不同frame的情况
			var aCtor = a.constructor, bCtor = b.constructor;
			if ( aCtor !== bCtor &&
					!( _.isFunction( aCtor ) && aCtor instanceof aCtor && _.isFunction( bCtor ) && bCtor instanceof bCtor ) &&
					('constructor' in a && 'constructor' in b ) ) {
				return false;
			}
		}

		// 这里已经完全看不懂了
		aStack = aStack || [];
		bStack = bStack || [];
		var length = aStack.length;
		while ( length-- ) {
			if ( aStack[ length ] === a ) return bStack[ length ] === b;
		}

		aStack.push( a );
		bStack.push( b );

		if ( areArrays ) {
			length = a.length;
			if ( length !== b.length ) return false;
			while ( length-- ) {
				if ( !eq( a[ length ], b[ length ], aStack, bStack ) ) return false;
			}
		} else {
			var keys = _.keys( a ), key;
			length = keys.length;
			if ( _.keys( b ).length !== length ) return false;
			while ( length-- ) {
				key = keys[ length ];
				if ( !( _.has( b, key ) && eq( a[ key ], b[ key ], aStack, bStack ) ) )
					return false;
			}
		}

		aStack.pop();
		bStack.pop();
		return true;
	};

	// deep comparison
	_.isEqual = function ( a, b ) {
		return eq( a, b );
	};

	_.isEmpty = function ( obj ) {
		if ( obj == null ) return true;
		if ( isArrayLike( obj ) && ( _.isArray( obj ) || _.isString( obj ) || _.isArguments( obj ) ) ) return obj.length === 0;
		return _.keys( obj ).length === 0;
	};

	_.isElement = function ( obj ) {
		return !!( obj && obj.nodeType === 1 );
	};

	_.isArray = nativeIsArray || function ( obj ) {
		return toString.call( obj ) === '[object Array]';
	};

	// 用typeof判断，把函数的情况加进去了，把null排除了
	_.isObject = function ( obj ) {
		var type = typeof obj;
		return type === 'function' || type === 'object' && !!obj;
	};

	// isType的经典判断方式
	_.each( [ 'Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet' ], function ( name ) {
		_[ 'is' + name ] = function ( obj ) {
			return toString.call( obj ) === '[object ' + name + ']';
		};
	});

	// isArguments的IE < 9 回退
	// 先判断上面那个是不是对这个大个的IIFE的arguments无效
	if ( !_.isArguments( arguments ) ) {
		_.isArguments = function ( obj ) {
			return _.has( obj, 'callee' );
		};
	}

	// isFunction的一些回退
	// IE 11, Safari 8, PhantomJS
	var nodelist = root.document && root.document.childNodes;
	if ( typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function' ) {
		_.isFunction = function ( obj ) {
			// 为什么要加|| false？
			return typeof obj == 'function' || false;
		};
	}

	// 原生isFinite有什么问题？
	_.isFinite = function ( obj ) {
		return !_.isSymbol( obj ) && isFinite( obj ) && !isNaN( parseFloat( obj ) );
	};

	// 修复原生isNaN的问题
	// 原生isNaN会先把参数转成Number，即相当于isNaN(Number(value))
	// 于是会有一些让人困惑的情况：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/isNaN
	_.isNaN = function ( obj ) {
		return _.isNumber( obj ) && isNaN( obj );
	};

	// 为什么不直接用最后一个，为了效率？
	_.isBoolean = function ( obj ) {
		return obj === true || obj === false || toString.call( obj ) === '[object Boolean]';
	};

	_.isNull = function ( obj ) {
		return obj === null;
	};

	_.isUndefined = function ( obj ) {
		return obj === void 0;
	};

	// hasOwnProperty加了path的功能
	// 会把obj改了吧？
	_.has = function ( obj, path ) {
		if ( !_.isArray( path ) ) {
			return obj != null && hasOwnProperty.call( obj, path );
		}
		var length = path.length;
		for ( var i = 0; i < length; i++ ) {
			var key = path[ i ];
			if ( obj == null || !hasOwnProperty.call( obj, key ) ) {
				return false;
			}
			obj = obj[ key ];
		}
		// path是[]的话也返回false
		return !!length;
	};

	// 通用方法
	// -----------

	// 例子：var a = _.noConflict;
	_.noConflict = function () {
		root._ = previousUnderscore;
		return this;
	};

	// 默认的iteratee，简单返回传入的值
	_.identity = function ( value ) {
		return value;
	};

	_.constant = function ( value ) {
		return function () {
			return value;
		};
	};

	_.noop = function () {};

	// 返回一个能返回指定属性的函数
	_.property = function ( path ) {
		if ( !_.isArray( path ) ) {
			return shallowProperty( path );
		}
		return function ( obj ) {
			return deepGet( obj, path );
		};
	};

	// 返回一个能返回指定对象属性的函数
	_.propertyOf = function ( obj ) {
		if ( obj == null ) {
			return function(){};
		}
		return function ( path ) {
			return !_.isArray( path ) ? obj[ path ] : deepGet( obj, path );
		};
	};

	// 返回一个谓词函数，用于判断对象是否有指定的键值对
	_.matcher = _.matches = function ( attrs ) {
		// 这里为啥需要extendOwn？
		attrs = _.extendOwn( {}, attrs );
		return function ( obj ) {
			return _.isMatch( obj, attrs );
		};
	};

	// 调用一个函数n次，该函数可以接受一个表示当前是第几次调用的参数
	_.times = function( n, iteratee, context ) {
		var accum = Array( Math.max( 0, n ) );
		iteratee = optimizeCb( iteratee, context, 1 );
		for ( var i = 0; i < n; i++ ) accum[ i ] = iteratee( i );
		return accum;
	};

	// 随机返回闭区间内一个整数
	_.random = function ( min, max ) {
		if ( max == null ) {
			max = min;
			min = 0;
		}
		return min + Math.floor( Math.random() * ( max - min + 1 ));
	};

	// Date.now是新方法，需要提供polyfill
	_.now = Date.now || function () {
		return new Date().getTime();
	};

	// 需要转义的html字符转义表
	var escapeMap = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;',
		'`': '&#x60;'
	};
	// 解义表
	var unescapeMap = _.invert( escapeMap );

	var createEscaper = function ( map ) {
		var escaper = function ( match ) {
			return map[ match ];
		};
		// 转义表对应的正则长这样：(?:&|<|>|"|'|`)
		// (?:x)是非捕获括号，匹配x但不捕获
		// 这里没有必要捕获，利用replace对每一个匹配调用escaper函数即可
		var source = '(?:' + _.keys( map ).join( '|' ) + ')';
		var testRegexp = RegExp( source );
		var replaceRegexp = RegExp( source, 'g' );
		return function ( string ) {
			string = string == null ? '' : '' + string;
			// 如果有匹配的，就利用replace接受正则和函数的特性，把所有匹配转义
			// 否则直接返回原字符串
			return testRegexp.test( string ) ? string.replace( replaceRegexp, escaper ) : string;
		};
	};
	_.escape = createEscaper( escapeMap );
	_.unescape = createEscaper( unescapeMap );

	// _.result(object, property, [defaultValue])
	// 如果property是函数，那么以object为上下文调用，否则返回property的值
	// fallback相当于默认行为，path未生效的时候调用
	_.result = function ( obj, path, fallback ) {
		if ( !_.isArray( path ) ) path = [ path ];
		var length = path.length;
		if ( !length ) {
			return _.isFunction( fallback ) ? fallback.call( obj ) : fallback;
		}
		for ( var i = 0; i < length; i++ ) {
			var prop = obj == null ? void 0 : obj[ path[ i ] ];
			if ( prop === void 0 ) {
				prop = fallback;
				i = length;
			}
			obj = _.isFunction( prop ) ? prop.call( obj ) : prop;
		}
		return obj;
	};

	var idCounter = 0;
	_.uniqueId = function ( prefix ) {
		var id = ++idCounter + '';
		return prefix ? prefix + id : id;
	};

	// 写\s\S和.有细微差别，.匹配不了换行符
	_.templateSettings = {
		evaluate: /<%([\s\S]+?)%>/g,
		interpolate: /<%=([\s\S]+?)%>/g,
		escape: /<%-([\s|\S]+?)%>/g
	};

	var noMatch = /(.)^/;

	// 这些东西要写在字符串字面量里面都是需要转义的
	var escapes = {
		"'": "'",
		'\\': '\\',
		'\r': 'r',
		'\n': 'n',
		// 分别是行分隔符和段落分隔符
		'\u2028': 'u2028',
		'\u2029': 'u2029'
	};

	var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

	var escapeChar = function ( match ) {
		return '\\' + escapes[ match ];
	};

	// 根据此处注释，oldSettings是为了旧版本的回退，最新官方文档也没有这个参数
	_.template = function ( text, settings, oldSettings ) {
		if ( !settings && oldSettings ) settings = oldSettings;
		// 用_.defaults，如果settings上没有定义那三个属性，就会填充上默认的
		// 至于从一个空对象开始填充，是避免直接修改了settings对象
		settings = _.defaults( {}, settings, _.templateSettings );

		// RegExp的source方法返回字符串形式
		// 把三种情况的正则拼起来，还有$?
		var matcher = RegExp([
			( settings.escape || noMatch ).source,
			( settings.interpolate || noMatch ).source,
			( settings.evaluate || noMatch ).source
		].join( '|' ) + '|$', 'g' );

		var index = 0;
		// source是render函数的函数体
		// 接下来“编译”source，转义字符串字面量
		var source = "__p+='";
		// replace第二个参数是一个函数的话，对每个匹配都会调用该函数，函数的参数
		// 列表是
		// 匹配的完整文本; 匹配的捕获，一个捕获对应一个参数; 匹配在源字符串中的
		// 索引; 源字符串
		text.replace( matcher, function ( match, escape, interpolate, evaluate, offset ) {
			// 匹配之前的部分进行特殊字符的转义
			source += text.slice( index, offset ).replace( escapeRegExp, escapeChar );
			index = offset + match.length;

			if ( escape ) {
				source += "'+\n((__t=(" + escape + "))===null?'':_.escape(__t))+\n'";
			} else if ( interpolate ) {
				source += "'+\n((__t=(" + interpolate + "))===null?'':__t)+\n'";
			} else if ( evaluate ) {
				source += "';\n" + evaluate + "\n__p+='";
			}

			return match;
		});
		source += "';\n";

		if ( !settings.variable ) source = 'with(obj||{}){\n' + source + '}\n';

		source = "var __t,__p='',__j=Array.prototype.join," +
			"print=function(){__p+=__j.call(arguments,'');};\n" +
			source + 'return __p;\n';

		var render;
		try {
			// Function( arg1, arg2, ..., argN, function_body )
			render = new Function( settings.variable || 'obj', '_', source);
		} catch ( e ) {
			e.source = source;
			throw e;
		}

		var template = function ( data ) {
			return render.call( this, data, _ );
		};

		// 这里设置template的source属性是为了预编译？
		var argument = settings.variable || 'obj';
		template.source = 'function(' + argument + '){\n' + source + '}';

		return template;
	};

	// OOP
	// ---------

	// 链式调用
	_.chain = function ( obj ) {
		var instance = _( obj );
		instance._chain = true;
		return instance;
	};

	// 链式调用的辅助函数，第一个参数是本次调用的上下文，第二个参数
	// 是本次函数调用的结果。只有调用chain函数的时候，才会有这里的第二种情况，
	// 返回chain函数的结果即可（obj的_.chain已设好)。其他情况下，都是把结果包装
	// 一下。
	// _chain属性应该理解为是否是调用_.chain函数，而不是是否链式调用的一个标志。
	// 要实现链式调用直接返回_(obj)就可以的，这里应该是为了处理chain函数这种情况
	// 额外做了一些工作。
	var chainResult = function ( instance, obj ) {
		return instance._chain ? _( obj ).chain() : obj;
	};

	_.mixin = function ( obj ) {
		_.each( _.functions( obj ), function ( name ) {
			var func = _[ name ] = obj[ name ];
			_.prototype[ name ] = function () {
				var args = [ this._wrapped ];
				push.apply( args, arguments );
				return chainResult( this, func.apply( _, args ) );
			};
		});
		return _;
	};

	// 把_的方法都加到_.prototype上
	_.mixin( _ );

	_.each( [ 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift' ], function ( name ) {
		var method = ArrayProto[ name ];
		_.prototype[ name ] = function () {
			var obj = this._wrapped;
			method.apply( obj, arguments );
			if (( name === 'shift' || name === 'splice' ) && obj.length === 0 )
				delete obj[ 0 ];
			return chainResult( this, obj );
		};
	});

	_.each( [ 'concat', 'join', 'slice' ], function ( name ) {
		var method = ArrayProto[ name ];
		_.prototype[ name ] = function () {
			return chainResult( this, method.apply( this._wrapped, arguments ) );
		};
	});

	_.prototype.value = function () {
		return this._wrapped;
	};

	_.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

	_.prototype.toString = function () {
		return String( this._wrapped );
	};

	// AMD
	if ( typeof define == 'function' && define.amd ) {
		define( 'underscore', [], function () {
			return _;
		});
	}

}());
