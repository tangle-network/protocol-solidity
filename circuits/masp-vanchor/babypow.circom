pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/escalarmulfix.circom";

template BabyPow() {
    signal input baseX;
    signal input baseY;
    signal input exp;
    signal output Ax;
    signal output Ay;


    var BASE[2] = [ baseX, baseY ];
    component pvkBits = Num2Bits(253);
    pvkBits.in <== exp;

    var n = 253;
    signal e[n];
    var c;
    for (c=0; c<253; c++) {
        e[c] <== pvkBits.out[c];
    }

    var nsegments = (n-1)\246 +1;       // 249 probably would work. But I'm not sure and for security I keep 246
    var nlastsegment = n - (nsegments-1)*249;

    component segments[nsegments];

    component m2e[nsegments-1];
    component adders[nsegments-1];

    var s;
    var i;
    var nseg;
    var nWindows;

    for (s=0; s<nsegments; s++) {

        nseg = (s < nsegments-1) ? 249 : nlastsegment;
        nWindows = ((nseg - 1)\3)+1;

        segments[s] = SegmentMulFix(nWindows);

        for (i=0; i<nseg; i++) {
            segments[s].e[i] <== e[s*249+i];
        }

        for (i = nseg; i<nWindows*3; i++) {
            segments[s].e[i] <== 0;
        }

        if (s==0) {
            segments[s].base[0] <== BASE[0];
            segments[s].base[1] <== BASE[1];
        } else {
            m2e[s-1] = Montgomery2Edwards();
            adders[s-1] = BabyAdd();

            segments[s-1].dbl[0] ==> m2e[s-1].in[0];
            segments[s-1].dbl[1] ==> m2e[s-1].in[1];

            m2e[s-1].out[0] ==> segments[s].base[0];
            m2e[s-1].out[1] ==> segments[s].base[1];

            if (s==1) {
                segments[s-1].out[0] ==> adders[s-1].x1;
                segments[s-1].out[1] ==> adders[s-1].y1;
            } else {
                adders[s-2].xout ==> adders[s-1].x1;
                adders[s-2].yout ==> adders[s-1].y1;
            }
            segments[s].out[0] ==> adders[s-1].x2;
            segments[s].out[1] ==> adders[s-1].y2;
        }
    }

    if (nsegments == 1) {
        segments[0].out[0] ==> Ax;
        segments[0].out[1] ==> Ay;
    } else {
        adders[nsegments-2].xout ==> Ax;
        adders[nsegments-2].yout ==> Ay;
    }
}