'''
 * Cinnamon RSS feed reader (python backend)
 *
 * Author: jake1164@hotmail.com
 * Date: 2013-2016
 *
 * Cinnamon RSS feed reader is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * Cinnamon RSS feed reader is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General
 * Public License for more details.  You should have received a copy of the GNU
 * General Public License along with Cinnamon RSS feed reader.  If not, see
 * <http://www.gnu.org/licenses/>.
'''

import sys
import os

if __name__ == "__main__":
	# Requires a file name to load, returns something
	load_file = sys.argv[1]

	if os.path.isfile(load_file):
		try:
			with open(load_file, 'r') as f:
				data = f.read()
				print (data)
		finally:
			f.close()
