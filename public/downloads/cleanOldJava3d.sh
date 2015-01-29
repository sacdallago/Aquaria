 
for f in j3dcore.jar j3dutils.jar vecmath.jar j3daudio.jar libJ3D.jnilib libJ3DAudio.jnilib libJ3DUtils.jnilib
do
 echo "Processing $f"
 # do something on $f
 sudo rm /System/Library/Java/Extensions/$f
done