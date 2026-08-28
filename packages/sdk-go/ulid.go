package convey

import (
	"crypto/rand"
	"sync"
	"time"
)

const crockfordEncoding = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

var (
	ulidMu       sync.Mutex
	lastULIDTime uint64
	lastEntropy  [10]byte
)

// GenerateULID generates a canonical 26-character Crockford Base32 ULID.
func GenerateULID() string {
	now := uint64(time.Now().UnixMilli())

	var entropy [10]byte

	ulidMu.Lock()
	if now == lastULIDTime {
		// Monotonic increment of entropy bytes
		for i := 9; i >= 0; i-- {
			lastEntropy[i]++
			if lastEntropy[i] != 0 {
				break
			}
		}
		entropy = lastEntropy
	} else {
		lastULIDTime = now
		_, _ = rand.Read(lastEntropy[:])
		entropy = lastEntropy
	}
	ulidMu.Unlock()

	var dst [26]byte

	// 10 chars timestamp (48 bits)
	dst[0] = crockfordEncoding[(now>>45)&0x1F]
	dst[1] = crockfordEncoding[(now>>40)&0x1F]
	dst[2] = crockfordEncoding[(now>>35)&0x1F]
	dst[3] = crockfordEncoding[(now>>30)&0x1F]
	dst[4] = crockfordEncoding[(now>>25)&0x1F]
	dst[5] = crockfordEncoding[(now>>20)&0x1F]
	dst[6] = crockfordEncoding[(now>>15)&0x1F]
	dst[7] = crockfordEncoding[(now>>10)&0x1F]
	dst[8] = crockfordEncoding[(now>>5)&0x1F]
	dst[9] = crockfordEncoding[now&0x1F]

	// 16 chars entropy (80 bits)
	dst[10] = crockfordEncoding[(entropy[0]>>3)&0x1F]
	dst[11] = crockfordEncoding[((entropy[0]&0x07)<<2)|((entropy[1]>>6)&0x03)]
	dst[12] = crockfordEncoding[(entropy[1]>>1)&0x1F]
	dst[13] = crockfordEncoding[((entropy[1]&0x01)<<4)|((entropy[2]>>4)&0x0F)]
	dst[14] = crockfordEncoding[((entropy[2]&0x0F)<<1)|((entropy[3]>>7)&0x01)]
	dst[15] = crockfordEncoding[(entropy[3]>>2)&0x1F]
	dst[16] = crockfordEncoding[((entropy[3]&0x03)<<3)|((entropy[4]>>5)&0x07)]
	dst[17] = crockfordEncoding[entropy[4]&0x1F]

	dst[18] = crockfordEncoding[(entropy[5]>>3)&0x1F]
	dst[19] = crockfordEncoding[((entropy[5]&0x07)<<2)|((entropy[6]>>6)&0x03)]
	dst[20] = crockfordEncoding[(entropy[6]>>1)&0x1F]
	dst[21] = crockfordEncoding[((entropy[6]&0x01)<<4)|((entropy[7]>>4)&0x0F)]
	dst[22] = crockfordEncoding[((entropy[7]&0x0F)<<1)|((entropy[8]>>7)&0x01)]
	dst[23] = crockfordEncoding[(entropy[8]>>2)&0x1F]
	dst[24] = crockfordEncoding[((entropy[8]&0x03)<<3)|((entropy[9]>>5)&0x07)]
	dst[25] = crockfordEncoding[entropy[9]&0x1F]

	return string(dst[:])
}
