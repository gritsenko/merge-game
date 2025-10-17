(function(global){
    // Simple Graphics helper for canvas - exposes Graphics with create(ctx)
    // Usage:
    //   const g = Graphics.create(ctx);
    //   g.roundedRect(x,y,width,height,radius,color);
    //   g.fillText(text,x,y,options);

    function create(ctx){
        return {
            roundedRect: function(x,y,width,height,radius,color){
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + width - radius, y);
                ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                ctx.lineTo(x + width, y + height - radius);
                ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                ctx.lineTo(x + radius, y + height);
                ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx.fill();
            },
            fillText: function(text,x,y,opts){
                opts = opts || {};
                if(opts.font) ctx.font = opts.font;
                if(opts.align) ctx.textAlign = opts.align;
                if(opts.baseline) ctx.textBaseline = opts.baseline;
                if(opts.color) ctx.fillStyle = opts.color;
                ctx.fillText(text,x,y);
            },
            measureText: function(text, opts){
                opts = opts || {};
                if(opts.font) ctx.font = opts.font;
                return ctx.measureText(text);
            },
            clear: function(x,y,width,height){
                ctx.clearRect(x,y,width,height);
            },
            withAlpha: function(alpha, callback){
                ctx.globalAlpha = alpha;
                callback();
                ctx.globalAlpha = 1.0;
            },
            drawImage: function(img, x, y, width, height){
                ctx.drawImage(img, x, y, width, height);
            }
        };
    }

    global.Graphics = { create };
})(this);
