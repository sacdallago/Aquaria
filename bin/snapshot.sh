SNAPSHOT_LOC=/Users/Webm/SparkleShare/Aquaria/Website/public/visualiser
SNAPSHOT_CP=$SNAPSHOT_LOC/j3d-1.6pre5/vecmath.jar:$SNAPSHOT_LOC/j3d-1.6pre5/j3dcore-pre5.jar:$SNAPSHOT_LOC/j3d-1.6pre5/j3dutils.jar:$SNAPSHOT_LOC/jogl-2.0r11/jogl-all.jar:$SNAPSHOT_LOC/gluegen-2.0r11/gluegen-rt.jar:$SNAPSHOT_LOC/aquaria2.jar
echo CP = $SNAPSHOT_CP
SNAPSHOT_ARGS="structures=structures{$1,http://aquaria.ws:8009/pdb/$1.pdb.gz,,;} sequenceView=on annotationView=off defaultStyle=Homology  saveImage=$3 sequenceAlignments=$2"
echo ARGS  = $SNAPSHOT_ARGS

SNAPSHOT_STR="$SNAPSHOT_CP org.srs3d.viewer.launch.CaptureApplication $SNAPSHOT_ARGS"

echo Whole String = $SNAPSHOT_STR
java -cp $SNAPSHOT_STR