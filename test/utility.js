(function () {
	var _ = typeof require == 'function' ? require( '..' ) : window._;

	QUnit.module( 'Utility' );
	QUnit.config.asyncRetries = 3;

	QUnit.test( 'template', function ( assert ) {
		var basicTemplate = _.template( "<%= thing %> is gettin' on my noives!");
		var result = basicTemplate( { thing: 'This' } );
		assert.strictEqual( result, "This is gettin' on my noives!", 'can do basic attribute interpolation' );
	});

}());
